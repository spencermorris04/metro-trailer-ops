<?php
/**
 * Plugin Name: Trailer Document Lookup Tool
 * Description: Provides a trailer document and metadata lookup form and REST endpoint backed by Microsoft Graph, SharePoint, and Business Central.
 * Version: 0.9.6
 * Author: Metro Trailer
 */

if (!defined('ABSPATH')) {
    exit;
}

define('METRO_REGISTRATION_LOOKUP_VERSION', '0.9.6');
define('METRO_REGISTRATION_LOOKUP_PATH', plugin_dir_path(__FILE__));
define('METRO_REGISTRATION_LOOKUP_URL', plugin_dir_url(__FILE__));

require_once METRO_REGISTRATION_LOOKUP_PATH . 'src/class-metro-registration-graph-client.php';
require_once METRO_REGISTRATION_LOOKUP_PATH . 'src/class-metro-registration-rest-controller.php';
require_once METRO_REGISTRATION_LOOKUP_PATH . 'src/class-metro-registration-settings.php';
require_once METRO_REGISTRATION_LOOKUP_PATH . 'src/class-metro-registration-shortcode.php';

register_activation_hook(__FILE__, static function () {
    Metro_Registration_Graph_Client::install_schema();

    if (!wp_next_scheduled('metro_registration_lookup_nightly_refresh')) {
        wp_schedule_event(time() + 300, 'daily', 'metro_registration_lookup_nightly_refresh');
    }
});

register_deactivation_hook(__FILE__, static function () {
    wp_clear_scheduled_hook('metro_registration_lookup_nightly_refresh');
    wp_clear_scheduled_hook('metro_registration_lookup_continue_refresh');
    wp_clear_scheduled_hook('metro_registration_lookup_continue_bc_refresh');
    wp_clear_scheduled_hook('metro_registration_lookup_continue_document_seed_worker');
    wp_clear_scheduled_hook('metro_registration_lookup_continue_document_delta_sync');
});

add_action('rest_api_init', static function () {
    $controller = new Metro_Registration_REST_Controller(
        new Metro_Registration_Graph_Client()
    );
    $controller->register_routes();
});

add_action('init', static function () {
    $shortcode = new Metro_Registration_Shortcode();
    $shortcode->register();
});

add_action('plugins_loaded', static function () {
    if (is_admin()) {
        $settings = new Metro_Registration_Settings();
        $settings->register();
    }
});

add_action('metro_registration_lookup_nightly_refresh', static function () {
    try {
        $client = new Metro_Registration_Graph_Client();
        $client->refresh_index_batch(true);
        $client->refresh_bc_asset_index_batch(true);

        if (!wp_next_scheduled('metro_registration_lookup_continue_refresh')) {
            wp_schedule_single_event(time() + 20, 'metro_registration_lookup_continue_refresh');
        }

        if (!wp_next_scheduled('metro_registration_lookup_continue_bc_refresh')) {
            wp_schedule_single_event(time() + 20, 'metro_registration_lookup_continue_bc_refresh');
        }

        $document_status = $client->get_document_sync_status();
        if (($document_status['seed_status'] ?? null) === 'ready' && !empty($document_status['delta_link'])) {
            $client->start_document_delta_sync(false);

            if (!wp_next_scheduled('metro_registration_lookup_continue_document_delta_sync')) {
                wp_schedule_single_event(time() + 20, 'metro_registration_lookup_continue_document_delta_sync');
            }
        } elseif (($document_status['seed_status'] ?? null) !== 'running' && ($document_status['seed_status'] ?? null) !== 'catchup' && ($document_status['total_folders'] ?? 0) > 0 && ($document_status['unknown_count'] ?? 0) > 0) {
            $client->start_document_seed(false);

            foreach ($client->get_document_seed_worker_ids() as $worker_id) {
                wp_schedule_single_event(time() + 20 + $worker_id, 'metro_registration_lookup_continue_document_seed_worker', [$worker_id]);
            }
        }
    } catch (Throwable $exception) {
        error_log('Metro registration nightly refresh failed to start: ' . $exception->getMessage());
    }
});

add_action('metro_registration_lookup_continue_refresh', static function () {
    try {
        $client = new Metro_Registration_Graph_Client();
        $status = $client->refresh_index_batch(false);

        if (($status['status'] ?? null) === 'running') {
            wp_schedule_single_event(time() + 20, 'metro_registration_lookup_continue_refresh');
        }
    } catch (Throwable $exception) {
        error_log('Metro registration refresh batch failed: ' . $exception->getMessage());
    }
});

add_action('metro_registration_lookup_continue_bc_refresh', static function () {
    try {
        $client = new Metro_Registration_Graph_Client();
        $status = $client->refresh_bc_asset_index_batch(false);

        if (($status['status'] ?? null) === 'running') {
            wp_schedule_single_event(time() + 20, 'metro_registration_lookup_continue_bc_refresh');
        }
    } catch (Throwable $exception) {
        error_log('Metro registration Business Central refresh batch failed: ' . $exception->getMessage());
    }
});

add_action('metro_registration_lookup_continue_document_seed_worker', static function ($worker_id = 0) {
    try {
        $client = new Metro_Registration_Graph_Client();
        $status = $client->process_document_seed_worker((int) $worker_id);

        if (($status['seed_status'] ?? null) === 'running' && ($status['workers'][(int) $worker_id]['status'] ?? null) === 'running') {
            wp_schedule_single_event(time() + 20, 'metro_registration_lookup_continue_document_seed_worker', [(int) $worker_id]);
        }

        if (($status['seed_status'] ?? null) === 'catchup') {
            wp_schedule_single_event(time() + 20, 'metro_registration_lookup_continue_document_delta_sync');
        }
    } catch (Throwable $exception) {
        error_log('Metro registration document seed worker failed: ' . $exception->getMessage());
    }
}, 10, 1);

add_action('metro_registration_lookup_continue_document_delta_sync', static function () {
    try {
        $client = new Metro_Registration_Graph_Client();
        $status = $client->process_document_delta_sync_batch();

        if (($status['delta_status'] ?? null) === 'running') {
            wp_schedule_single_event(time() + 20, 'metro_registration_lookup_continue_document_delta_sync');
        }
    } catch (Throwable $exception) {
        error_log('Metro registration document delta sync failed: ' . $exception->getMessage());
    }
});

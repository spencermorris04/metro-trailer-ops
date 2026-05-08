<?php
/**
 * Plugin Name: Trailer Document Lookup Tool
 * Description: Provides a trailer document and metadata lookup form and REST endpoint backed by Microsoft Graph, SharePoint, and Business Central.
 * Version: 0.7.8
 * Author: Metro Trailer
 */

if (!defined('ABSPATH')) {
    exit;
}

define('METRO_REGISTRATION_LOOKUP_VERSION', '0.7.8');
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

<?php

if (!class_exists('Metro_Registration_REST_Controller')) {
    class Metro_Registration_REST_Controller
    {
        private Metro_Registration_Graph_Client $graph_client;

        public function __construct(Metro_Registration_Graph_Client $graph_client)
        {
            $this->graph_client = $graph_client;
        }

        public function register_routes(): void
        {
            register_rest_route('metro/v1', '/trailers', [
                'methods' => WP_REST_Server::READABLE,
                'callback' => [$this, 'search_trailers'],
                'permission_callback' => '__return_true',
                'args' => [
                    'query' => [
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'limit' => [
                        'required' => false,
                        'sanitize_callback' => 'absint',
                    ],
                ],
            ]);

            register_rest_route('metro/v1', '/trailers/exact-batch', [
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => [$this, 'lookup_exact_batch'],
                'permission_callback' => '__return_true',
            ]);

            register_rest_route('metro/v1', '/trailers/document-availability', [
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => [$this, 'get_document_availability'],
                'permission_callback' => '__return_true',
            ]);

            register_rest_route('metro/v1', '/trailers/(?P<folderId>[^/]+)/documents', [
                'methods' => WP_REST_Server::READABLE,
                'callback' => [$this, 'get_documents'],
                'permission_callback' => '__return_true',
                'args' => [
                    'folderId' => [
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ]);

            register_rest_route('metro/v1', '/documents/(?P<documentId>[^/]+)/download', [
                'methods' => WP_REST_Server::READABLE,
                'callback' => [$this, 'download_document'],
                'permission_callback' => '__return_true',
                'args' => [
                    'documentId' => [
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ]);

            register_rest_route('metro/v1', '/registrations/bulk-download', [
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => [$this, 'download_bulk_registrations'],
                'permission_callback' => '__return_true',
            ]);

            register_rest_route('metro/v1', '/registration/(?P<trailerNumber>[A-Za-z0-9_-]+)', [
                'methods' => WP_REST_Server::READABLE,
                'callback' => [$this, 'get_registration'],
                'permission_callback' => '__return_true',
                'args' => [
                    'trailerNumber' => [
                        'required' => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ]);
        }

        public function search_trailers(WP_REST_Request $request)
        {
            try {
                $query = (string) $request->get_param('query');
                $limit = (int) ($request->get_param('limit') ?: 24);

                return new WP_REST_Response(
                    $this->graph_client->search_trailer_folders($query, $limit),
                    200
                );
            } catch (Metro_Registration_Graph_Exception $exception) {
                return $this->build_error('metro_registration_search_failed', $exception);
            } catch (Throwable $exception) {
                return $this->build_unexpected_error($exception);
            }
        }

        public function lookup_exact_batch(WP_REST_Request $request)
        {
            try {
                $body = $request->get_json_params();
                $trailers = [];

                if (is_array($body) && isset($body['trailers']) && is_array($body['trailers'])) {
                    $trailers = $body['trailers'];
                } else {
                    $trailers = (array) $request->get_param('trailers');
                }

                return new WP_REST_Response(
                    $this->graph_client->lookup_exact_trailer_batch($trailers),
                    200
                );
            } catch (Metro_Registration_Graph_Exception $exception) {
                return $this->build_error('metro_registration_exact_batch_failed', $exception);
            } catch (Throwable $exception) {
                return $this->build_unexpected_error($exception);
            }
        }

        public function get_document_availability(WP_REST_Request $request)
        {
            try {
                $body = $request->get_json_params();
                $folder_ids = [];

                if (is_array($body) && isset($body['folderIds']) && is_array($body['folderIds'])) {
                    $folder_ids = $body['folderIds'];
                } else {
                    $folder_ids = (array) $request->get_param('folderIds');
                }

                return new WP_REST_Response(
                    $this->graph_client->get_document_availability_batch($folder_ids),
                    200
                );
            } catch (Metro_Registration_Graph_Exception $exception) {
                return $this->build_error('metro_registration_document_availability_failed', $exception);
            } catch (Throwable $exception) {
                return $this->build_unexpected_error($exception);
            }
        }

        public function get_documents(WP_REST_Request $request)
        {
            try {
                $folder_id = (string) $request->get_param('folderId');

                return new WP_REST_Response(
                    $this->graph_client->get_trailer_documents($folder_id),
                    200
                );
            } catch (Metro_Registration_Graph_Exception $exception) {
                return $this->build_error('metro_registration_documents_failed', $exception);
            } catch (Throwable $exception) {
                return $this->build_unexpected_error($exception);
            }
        }

        public function download_document(WP_REST_Request $request)
        {
            try {
                $document_id = (string) $request->get_param('documentId');
                $document = $this->graph_client->download_document($document_id);

                $this->stream_document($document);
            } catch (Metro_Registration_Graph_Exception $exception) {
                return $this->build_error('metro_registration_download_failed', $exception);
            } catch (Throwable $exception) {
                return $this->build_unexpected_error($exception);
            }
        }

        public function get_registration(WP_REST_Request $request)
        {
            try {
                $trailer_number = (string) $request->get_param('trailerNumber');
                $document = $this->graph_client->get_registration_pdf($trailer_number);

                $this->stream_document($document);
            } catch (Metro_Registration_Graph_Exception $exception) {
                return $this->build_error('metro_registration_lookup_failed', $exception);
            } catch (Throwable $exception) {
                return $this->build_unexpected_error($exception);
            }
        }

        public function download_bulk_registrations(WP_REST_Request $request)
        {
            try {
                $body = $request->get_json_params();
                $folder_ids = [];

                if (is_array($body) && isset($body['folderIds']) && is_array($body['folderIds'])) {
                    $folder_ids = $body['folderIds'];
                } else {
                    $folder_ids = (array) $request->get_param('folderIds');
                }

                $document = $this->graph_client->download_registration_batch($folder_ids);
                $this->stream_document($document, true);
            } catch (Metro_Registration_Graph_Exception $exception) {
                return $this->build_error('metro_registration_bulk_download_failed', $exception);
            } catch (Throwable $exception) {
                return $this->build_unexpected_error($exception);
            }
        }

        private function stream_document(array $document, bool $attachment = false): void
        {
            $filename = sanitize_file_name($document['filename'] ?: 'document.pdf');
            $disposition = $attachment ? 'attachment' : 'inline';

            nocache_headers();
            status_header(200);
            header('Content-Type: ' . ($document['content_type'] ?: 'application/octet-stream'));
            header('Content-Length: ' . strlen($document['content']));
            header('Content-Disposition: ' . $disposition . '; filename="' . $filename . '"');
            header('X-Content-Type-Options: nosniff');

            if (!empty($document['web_url'])) {
                header('X-SharePoint-File-Url: ' . esc_url_raw($document['web_url']));
            }

            echo $document['content'];
            exit;
        }

        private function build_error(string $code, Metro_Registration_Graph_Exception $exception): WP_Error
        {
            error_log('Metro registration lookup failed: ' . $exception->getMessage());

            return new WP_Error(
                $code,
                $exception->getMessage(),
                [
                    'status' => $exception->get_http_status(),
                    'details' => $exception->get_raw_details() ? json_decode($exception->get_raw_details(), true) : null,
                ]
            );
        }

        private function build_unexpected_error(Throwable $exception): WP_Error
        {
            error_log('Metro registration lookup unexpected error: ' . $exception->getMessage());

            return new WP_Error(
                'metro_registration_lookup_unexpected_error',
                'Unexpected server error.',
                [
                    'status' => 500,
                ]
            );
        }
    }
}

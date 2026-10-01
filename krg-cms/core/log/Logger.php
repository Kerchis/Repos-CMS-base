<?php
/**
 * Internal logger. Never printed to visitors.
 *
 * @package Meridian
 */

namespace Meridian\Log;

defined( 'ABSPATH' ) || exit;

class Logger {

	public static function log( string $level, string $message, array $context = [] ): void {
		$settings = get_option( MERIDIAN_OPTION_SETTINGS, [] );
		$debug    = ! empty( $settings['debug'] );
		if ( ! $debug && 'debug' === $level ) {
			return;
		}
		if ( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
			error_log( '[KRG][' . $level . '] ' . $message . ( $context ? ' ' . wp_json_encode( $context ) : '' ) ); // phpcs:ignore
		}
		if ( ! $debug ) {
			return;
		}
		global $wpdb;
		$table = $wpdb->prefix . 'meridian_logs';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			$table,
			[
				'level'      => sanitize_key( $level ),
				'message'    => substr( wp_strip_all_tags( $message ), 0, 5000 ),
				'context'    => wp_json_encode( $context ),
				'created_at' => current_time( 'mysql' ),
			]
		);
	}

	public static function error( string $message, array $context = [] ): void {
		self::log( 'error', $message, $context );
	}
}

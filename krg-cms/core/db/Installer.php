<?php
/**
 * Database installer.
 *
 * @package Meridian
 */

namespace Meridian\Db;

defined( 'ABSPATH' ) || exit;

class Installer {

	public const SCHEMA_VERSION = '1.0.0';

	public static function install(): void {
		self::create_tables();
		\Meridian\Admin\Capabilities::install();
		\Meridian\Design\TokenRepository::ensure_defaults();
		\Meridian\Content\Seeder::run();
		update_option( 'meridian_schema_version', self::SCHEMA_VERSION );
	}

	public static function maybe_upgrade(): void {
		if ( get_option( 'meridian_schema_version' ) !== self::SCHEMA_VERSION ) {
			self::create_tables();
			update_option( 'meridian_schema_version', self::SCHEMA_VERSION );
		}
	}

	public static function create_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset = $wpdb->get_charset_collate();
		$rev     = $wpdb->prefix . 'meridian_revisions';
		$logs    = $wpdb->prefix . 'meridian_logs';

		$sql = "CREATE TABLE {$rev} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			post_id bigint(20) unsigned NOT NULL DEFAULT 0,
			entity_type varchar(32) NOT NULL,
			snapshot longtext NOT NULL,
			author_id bigint(20) unsigned NOT NULL DEFAULT 0,
			origin varchar(32) NOT NULL,
			checksum varchar(64) NOT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY post_created (post_id, created_at)
		) {$charset};";

		$sql2 = "CREATE TABLE {$logs} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			level varchar(16) NOT NULL,
			message text NOT NULL,
			context longtext NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id)
		) {$charset};";

		dbDelta( $sql );
		dbDelta( $sql2 );
	}
}

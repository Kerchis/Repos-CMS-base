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
		self::release_forced_caps();
	}

	/**
	 * Suelta las mayúsculas forzadas que heredaron las instalaciones antiguas.
	 *
	 * Los módulos llevaban «text-transform: uppercase» escrito a fuego en el
	 * CSS y los ajustes preestablecidos guardaban «uppercase» en cada rol de
	 * tipografía, así que todo el sitio salía en versales y la opción de
	 * tipografía no servía de nada. Ahora manda el token, pero quien ya tenga
	 * los ajustes guardados seguiría viendo versales sin esta pasada. Se hace
	 * una sola vez y respeta cualquier valor que no sea «uppercase».
	 */
	private static function release_forced_caps(): void {
		if ( get_option( 'meridian_caps_released' ) ) {
			return;
		}
		update_option( 'meridian_caps_released', 1, false );

		$tokens = get_option( MERIDIAN_OPTION_TOKENS );
		if ( ! is_array( $tokens ) || empty( $tokens['tokens']['typography'] ) ) {
			return;
		}
		$typo    = $tokens['tokens']['typography'];
		$touched = false;
		foreach ( $typo as $role => $item ) {
			if ( is_array( $item ) && isset( $item['textTransform'] ) && 'uppercase' === $item['textTransform'] ) {
				$typo[ $role ]['textTransform'] = 'none';
				$touched                        = true;
			}
		}
		if ( ! $touched ) {
			return;
		}
		$tokens['tokens']['typography'] = $typo;
		update_option( MERIDIAN_OPTION_TOKENS, $tokens, false );

		// Las mismas invalidaciones que hace el repositorio al guardar.
		wp_cache_delete( MERIDIAN_OPTION_TOKENS, 'options' );
		wp_cache_delete( 'alloptions', 'options' );
		delete_transient( 'meridian_tokens_css' );
		if ( class_exists( '\\Meridian\\Cache\\DocumentCache' ) ) {
			\Meridian\Cache\DocumentCache::flush_chrome();
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

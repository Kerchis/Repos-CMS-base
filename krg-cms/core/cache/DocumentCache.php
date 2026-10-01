<?php
/**
 * Published HTML/CSS cache keyed by document checksum.
 *
 * @package Meridian
 */

namespace Meridian\Cache;

defined( 'ABSPATH' ) || exit;

class DocumentCache {

	public const HTML = '_meridian_html';
	public const CSS  = '_meridian_css';
	public const SUM  = '_meridian_render_sum';
	public const CHROME = 'meridian_chrome_css';

	public static function html( int $id, string $sum ): ?string {
		if ( ! $id || ! $sum ) {
			return null;
		}
		if ( (string) get_post_meta( $id, self::SUM, true ) !== $sum ) {
			return null;
		}
		$html = get_post_meta( $id, self::HTML, true );
		return is_string( $html ) && $html !== '' ? $html : null;
	}

	public static function css( int $id, string $sum ): ?string {
		if ( ! $id || ! $sum ) {
			return null;
		}
		if ( (string) get_post_meta( $id, self::SUM, true ) !== $sum ) {
			return null;
		}
		$css = get_post_meta( $id, self::CSS, true );
		return is_string( $css ) ? $css : null;
	}

	public static function put( int $id, string $sum, string $html, string $css ): void {
		if ( ! $id || ! $sum ) {
			return;
		}
		update_post_meta( $id, self::HTML, $html );
		update_post_meta( $id, self::CSS, $css );
		update_post_meta( $id, self::SUM, $sum );
	}

	public static function flush_page( int $id ): void {
		delete_post_meta( $id, self::HTML );
		delete_post_meta( $id, self::CSS );
		delete_post_meta( $id, self::SUM );
	}

	public static function flush_chrome(): void {
		delete_transient( self::CHROME );
	}

	public static function flush_all(): array {
		global $wpdb;
		$keys = [ self::HTML, self::CSS, self::SUM ];
		$n    = 0;
		foreach ( $keys as $key ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$deleted = $wpdb->delete( $wpdb->postmeta, [ 'meta_key' => $key ], [ '%s' ] );
			if ( false !== $deleted ) {
				$n += (int) $deleted;
			}
		}
		self::flush_chrome();
		wp_cache_flush();
		return [ 'pages' => $n, 'ok' => true ];
	}

	public static function chrome_css(): string {
		$cached = get_transient( self::CHROME );
		if ( is_string( $cached ) && $cached !== '' ) {
			return $cached;
		}
		$css = \Meridian\Style\Chrome::css() . \Meridian\Style\DocumentCssCompiler::visibility_css();
		$f   = \Meridian\Navigation\Menus::footer();
		if ( ! empty( $f['sections'] ) && is_array( $f['sections'] ) ) {
			$css .= \Meridian\Style\DocumentCssCompiler::compile( [ 'sections' => $f['sections'] ] );
		}
		set_transient( self::CHROME, $css, DAY_IN_SECONDS );
		return $css;
	}
}

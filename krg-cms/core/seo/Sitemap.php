<?php
/**
 * Public sitemap.xml (pages + posts).
 *
 * @package Meridian
 */

namespace Meridian\Seo;

defined( 'ABSPATH' ) || exit;

class Sitemap {

	public static function maybe_output(): void {
		if ( empty( $_SERVER['REQUEST_URI'] ) ) {
			return;
		}
		$path      = wp_parse_url( wp_unslash( $_SERVER['REQUEST_URI'] ), PHP_URL_PATH );
		$expected  = wp_parse_url( home_url( '/sitemap.xml' ), PHP_URL_PATH );
		if ( ! $path || ! $expected ) {
			return;
		}
		if ( untrailingslashit( $path ) !== untrailingslashit( $expected ) ) {
			return;
		}
		self::send();
	}

	public static function send(): void {
		nocache_headers();
		header( 'Content-Type: application/xml; charset=UTF-8' );
		echo self::xml(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		exit;
	}

	public static function xml(): string {
		$urls = [];
		$urls[] = [
			'loc'      => home_url( '/' ),
			'lastmod'  => gmdate( 'c' ),
			'priority' => '1.0',
		];

		$front = (int) get_option( 'page_on_front' );
		$pages = get_posts(
			[
				'post_type'      => 'page',
				'post_status'    => 'publish',
				'posts_per_page' => 500,
				'orderby'        => 'modified',
				'order'          => 'DESC',
			]
		);
		foreach ( $pages as $p ) {
			if ( $front && (int) $p->ID === $front ) {
				continue;
			}
			if ( self::is_noindex_page( (int) $p->ID ) ) {
				continue;
			}
			$urls[] = [
				'loc'      => get_permalink( $p ),
				'lastmod'  => get_post_modified_time( 'c', true, $p ),
				'priority' => '0.8',
			];
		}

		$posts = get_posts(
			[
				'post_type'      => 'post',
				'post_status'    => 'publish',
				'posts_per_page' => 500,
				'orderby'        => 'modified',
				'order'          => 'DESC',
			]
		);
		foreach ( $posts as $p ) {
			$seo    = get_post_meta( $p->ID, '_meridian_seo', true );
			$robots = is_array( $seo ) ? ( $seo['robots'] ?? 'index,follow' ) : 'index,follow';
			if ( str_contains( (string) $robots, 'noindex' ) ) {
				continue;
			}
			$urls[] = [
				'loc'      => get_permalink( $p ),
				'lastmod'  => get_post_modified_time( 'c', true, $p ),
				'priority' => '0.6',
			];
		}

		$out  = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
		$out .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
		foreach ( $urls as $u ) {
			$out .= "  <url>\n";
			$out .= '    <loc>' . esc_url( $u['loc'] ) . "</loc>\n";
			if ( ! empty( $u['lastmod'] ) ) {
				$out .= '    <lastmod>' . esc_html( $u['lastmod'] ) . "</lastmod>\n";
			}
			$out .= '    <priority>' . esc_html( $u['priority'] ) . "</priority>\n";
			$out .= "  </url>\n";
		}
		$out .= '</urlset>';
		return $out;
	}

	private static function is_noindex_page( int $id ): bool {
		$doc = \Meridian\Content\PageRepository::get( $id, 'published' );
		if ( ! $doc ) {
			return false;
		}
		$robots = $doc['seo']['robots'] ?? 'index,follow';
		return str_contains( (string) $robots, 'noindex' );
	}
}

<?php
/**
 * Preview mode.
 *
 * @package Meridian
 */

namespace Meridian\Render;

defined( 'ABSPATH' ) || exit;

class Preview {

	public static function register_query_var(): void {
		// Query string krgcms_preview is enough.
	}

	public static function is_preview(): bool {
		return isset( $_GET['krgcms_preview'] ) || isset( $_GET['krg_preview'] ) || isset( $_GET['meridian_preview'] ); // phpcs:ignore WordPress.Security.NonceVerification
	}

	public static function guard(): void {
		if ( ! self::is_preview() ) {
			return;
		}
		if ( ! is_user_logged_in() || ! ( current_user_can( 'meridian_edit_pages' ) || current_user_can( 'edit_pages' ) ) ) {
			wp_die( esc_html__( 'No tienes permiso para previsualizar.', 'meridian' ), 403 );
		}
		$nonce = sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
		if ( ! wp_verify_nonce( $nonce, 'krgcms_preview' ) && ! wp_verify_nonce( $nonce, 'krg_preview' ) && ! wp_verify_nonce( $nonce, 'meridian_preview' ) ) {
			wp_die( esc_html__( 'La previsualización no es válida.', 'meridian' ), 403 );
		}
		nocache_headers();
		header( 'X-Robots-Tag: noindex, nofollow' );
	}

	public static function maybe_hide_admin_bar( $show ) {
		if ( is_admin() ) {
			return $show;
		}
		return false;
	}

	public static function url( int $page_id ): string {
		$base = get_permalink( $page_id );
		if ( ! $base ) {
			$base = home_url( '/' );
		}
		return add_query_arg(
			[
				'krgcms_preview' => '1',
				'_wpnonce'       => wp_create_nonce( 'krgcms_preview' ),
			],
			$base
		);
	}

	public static function home_url(): string {
		return add_query_arg(
			[
				'krgcms_preview' => '1',
				'krgcms_chrome'  => '1',
				'_wpnonce'       => wp_create_nonce( 'krgcms_preview' ),
			],
			home_url( '/' )
		);
	}
}

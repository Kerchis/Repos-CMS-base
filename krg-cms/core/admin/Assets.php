<?php
/**
 * Admin assets.
 *
 * @package Meridian
 */

namespace Meridian\Admin;

defined( 'ABSPATH' ) || exit;

class Assets {

	public static function enqueue( string $hook ): void {
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : ''; // phpcs:ignore
		if ( ! str_starts_with( $page, 'krg' ) ) {
			return;
		}

		wp_enqueue_media();
		wp_enqueue_style( 'krg-admin', MERIDIAN_URI . '/admin/assets/css/admin.css', [], meridian_ver( '/admin/assets/css/admin.css' ) );
		wp_enqueue_script( 'krg-admin', MERIDIAN_URI . '/admin/assets/js/app.js', [], meridian_ver( '/admin/assets/js/app.js' ), true );
		$skin_css = \Meridian\Admin\Skin::css();
		if ( $skin_css ) {
			wp_add_inline_style( 'krg-admin', $skin_css );
		}
		if ( 'krg-design' === $page || 'krg-builder' === $page ) {
			\Meridian\Design\FontCatalog::enqueue_used( 'krg-admin' );
		}

		$config = [
			'rest'         => esc_url_raw( rest_url( MERIDIAN_REST ) ),
			'nonce'        => wp_create_nonce( 'wp_rest' ),
			'admin'        => admin_url( 'admin.php' ),
			'wpAdmin'      => admin_url( 'index.php' ),
			'home'         => home_url( '/' ),
			'ajax'         => admin_url( 'admin-ajax.php' ),
			'page'         => $page,
			'pageId'       => absint( $_GET['id'] ?? 0 ), // phpcs:ignore
			'chrome'       => sanitize_key( wp_unslash( $_GET['chrome'] ?? '' ) ), // phpcs:ignore
			'preview'      => \Meridian\Render\Preview::home_url(),
			'canManage'    => current_user_can( 'meridian_manage' ),
			'canPublish'   => current_user_can( 'meridian_publish_pages' ),
			'canEditPages' => current_user_can( 'meridian_edit_pages' ),
			'user'         => wp_get_current_user()->display_name,
			'view'         => sanitize_key( wp_unslash( $_GET['view'] ?? '' ) ), // phpcs:ignore
		];
		wp_localize_script( 'krg-admin', 'KrgAdmin', $config );

		$is_builder = ( 'krg-builder' === $page );
		if ( $is_builder ) {
			wp_enqueue_style( 'krg-builder', MERIDIAN_URI . '/admin/assets/css/builder.css', [ 'krg-admin' ], meridian_ver( '/admin/assets/css/builder.css' ) );
			if ( ! empty( $config['chrome'] ) ) {
				wp_enqueue_script( 'krg-chrome', MERIDIAN_URI . '/admin/assets/js/chrome.js', [ 'krg-admin' ], meridian_ver( '/admin/assets/js/chrome.js' ), true );
			} else {
				wp_enqueue_script( 'krg-builder', MERIDIAN_URI . '/admin/assets/js/builder.js', [ 'krg-admin' ], meridian_ver( '/admin/assets/js/builder.js' ), true );
			}
		}

		add_action( 'admin_head', [ self::class, 'hide_wp_chrome' ] );
	}

	public static function hide_wp_chrome(): void {
		echo '<style>
			#wpadminbar,#adminmenumain,#wpfooter,#screen-meta,#screen-meta-links{display:none!important}
			html.wp-toolbar{padding-top:0!important}
			#wpcontent,#wpbody,#wpbody-content{margin:0!important;padding:0!important}
			.notice,.update-nag{display:none!important}
			body{background:#f5f5f3}
		</style>';
	}
}

<?php
/**
 * Admin menus.
 *
 * @package Meridian
 */

namespace Meridian\Admin;

defined( 'ABSPATH' ) || exit;

class Menu {

	public static function register(): void {
		add_menu_page(
			__( 'KRG CMS', 'meridian' ),
			__( 'KRG CMS', 'meridian' ),
			'edit_posts',
			'krg',
			[ self::class, 'app' ],
			'dashicons-layout',
			2
		);
		add_submenu_page( 'krg', __( 'Inicio', 'meridian' ), __( 'Inicio', 'meridian' ), 'meridian_edit_pages', 'krg', [ self::class, 'app' ] );
		add_submenu_page( 'krg', __( 'Páginas', 'meridian' ), __( 'Páginas', 'meridian' ), 'meridian_edit_pages', 'krg-pages', [ self::class, 'app' ] );
		add_submenu_page( 'krg', __( 'Constructor', 'meridian' ), __( 'Constructor', 'meridian' ), 'meridian_edit_pages', 'krg-builder', [ self::class, 'builder' ] );
		add_submenu_page( 'krg', __( 'Blog', 'meridian' ), __( 'Blog', 'meridian' ), 'edit_posts', 'krg-blog', [ self::class, 'app' ] );
		add_submenu_page( 'krg', __( 'Apariencia', 'meridian' ), __( 'Apariencia', 'meridian' ), 'meridian_manage', 'krg-design', [ self::class, 'app' ] );
		add_submenu_page( 'krg', __( 'Navegación', 'meridian' ), __( 'Navegación', 'meridian' ), 'meridian_manage', 'krg-nav', [ self::class, 'app' ] );
		add_submenu_page( 'krg', __( 'SEO', 'meridian' ), __( 'SEO', 'meridian' ), 'meridian_manage', 'krg-seo', [ self::class, 'app' ] );
		add_submenu_page( 'krg', __( 'Usuarios', 'meridian' ), __( 'Usuarios', 'meridian' ), 'meridian_manage', 'krg-users', [ self::class, 'app' ] );
		add_submenu_page( 'krg', __( 'Configuración', 'meridian' ), __( 'Configuración', 'meridian' ), 'meridian_manage', 'krg-settings', [ self::class, 'app' ] );
	}

	public static function redirect_legacy(): void {
		$page = sanitize_key( wp_unslash( $_GET['page'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
		if ( ! str_starts_with( $page, 'meridian' ) ) {
			return;
		}
		$map = [
			'meridian'          => 'krg',
			'meridian-pages'    => 'krg-pages',
			'meridian-builder'  => 'krg-builder',
			'meridian-blog'     => 'krg-blog',
			'meridian-design'   => 'krg-design',
			'meridian-nav'      => 'krg-nav',
			'meridian-seo'      => 'krg-seo',
			'meridian-users'    => 'krg-users',
			'meridian-settings' => 'krg-settings',
		];
		if ( ! isset( $map[ $page ] ) ) {
			return;
		}
		$args         = wp_unslash( $_GET ); // phpcs:ignore WordPress.Security.NonceVerification
		$args['page'] = $map[ $page ];
		wp_safe_redirect( admin_url( 'admin.php?' . http_build_query( $args ) ) );
		exit;
	}

	public static function app(): void {
		$page        = sanitize_key( wp_unslash( $_GET['page'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
		$need_edit   = [ 'krg', 'krg-pages', 'krg-builder' ];
		$need_manage = [ 'krg-design', 'krg-nav', 'krg-seo', 'krg-settings', 'krg-users' ];
		if ( in_array( $page, $need_edit, true ) && ! current_user_can( 'meridian_edit_pages' ) ) {
			wp_safe_redirect( admin_url( 'admin.php?page=krg-blog' ) );
			exit;
		}
		if ( in_array( $page, $need_manage, true ) && ! current_user_can( 'meridian_manage' ) ) {
			wp_die( esc_html__( 'No tienes permiso para esta sección.', 'meridian' ), 403 );
		}
		echo '<div id="krg-admin" class="krg-admin"></div>';
	}

	public static function builder(): void {
		echo '<div id="krg-builder" class="krg-builder"></div>';
	}
}

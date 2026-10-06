<?php
/**
 * REST routes.
 *
 * @package Meridian
 */

namespace Meridian\Api;

defined( 'ABSPATH' ) || exit;

class Routes {

	public static function register(): void {
		$ns = MERIDIAN_REST;

		$edit  = static fn() => current_user_can( 'meridian_edit_pages' ) || current_user_can( 'edit_pages' );
		$pub   = static fn() => current_user_can( 'meridian_publish_pages' ) || current_user_can( 'publish_pages' );
		$manage = static fn() => current_user_can( 'meridian_manage' );
		$users  = static fn() => current_user_can( 'create_users' ) && current_user_can( 'meridian_manage' );
		$posts = static fn() => current_user_can( 'edit_posts' );

		register_rest_route( $ns, '/bootstrap', [
			'methods' => 'GET',
			'permission_callback' => $edit,
			'callback' => [ Controller::class, 'bootstrap' ],
		] );

		register_rest_route( $ns, '/pages', [
			[
				'methods' => 'GET',
				'permission_callback' => $edit,
				'callback' => [ Controller::class, 'pages_list' ],
			],
			[
				'methods' => 'POST',
				'permission_callback' => $edit,
				'callback' => [ Controller::class, 'pages_create' ],
			],
		] );

		register_rest_route( $ns, '/pages/(?P<id>\d+)', [
			[
				'methods' => 'GET',
				'permission_callback' => $edit,
				'callback' => [ Controller::class, 'pages_get' ],
			],
			[
				'methods' => 'PATCH',
				'permission_callback' => $edit,
				'callback' => [ Controller::class, 'pages_save' ],
			],
			[
				'methods' => 'POST',
				'permission_callback' => $edit,
				'callback' => [ Controller::class, 'pages_save' ],
			],
			[
				'methods' => 'DELETE',
				'permission_callback' => $edit,
				'callback' => [ Controller::class, 'pages_delete' ],
			],
		] );

		register_rest_route( $ns, '/pages/(?P<id>\d+)/publish', [
			'methods' => 'POST',
			'permission_callback' => $pub,
			'callback' => [ Controller::class, 'pages_publish' ],
		] );
		register_rest_route( $ns, '/pages/(?P<id>\d+)/duplicate', [
			'methods' => 'POST',
			'permission_callback' => $edit,
			'callback' => [ Controller::class, 'pages_duplicate' ],
		] );
		register_rest_route( $ns, '/pages/(?P<id>\d+)/settings', [
			'methods' => 'POST',
			'permission_callback' => $edit,
			'callback' => [ Controller::class, 'pages_settings' ],
		] );
		register_rest_route( $ns, '/site/front', [
			'methods' => 'POST',
			'permission_callback' => $edit,
			'callback' => [ Controller::class, 'site_front' ],
		] );
		register_rest_route( $ns, '/pages/(?P<id>\d+)/preview-url', [
			'methods' => 'GET',
			'permission_callback' => $edit,
			'callback' => [ Controller::class, 'pages_preview' ],
		] );
		register_rest_route( $ns, '/pages/(?P<id>\d+)/review', [
			'methods' => 'GET',
			'permission_callback' => $edit,
			'callback' => [ Controller::class, 'pages_review' ],
		] );
		register_rest_route( $ns, '/pages/(?P<id>\d+)/revisions', [
			'methods' => 'GET',
			'permission_callback' => $edit,
			'callback' => [ Controller::class, 'revisions_list' ],
		] );
		register_rest_route( $ns, '/pages/(?P<id>\d+)/revisions/(?P<rid>\d+)', [
			'methods' => 'GET',
			'permission_callback' => $edit,
			'callback' => [ Controller::class, 'revisions_get' ],
		] );
		register_rest_route( $ns, '/pages/(?P<id>\d+)/revisions/(?P<rid>\d+)/restore', [
			'methods' => 'POST',
			'permission_callback' => $edit,
			'callback' => [ Controller::class, 'revisions_restore' ],
		] );

		register_rest_route( $ns, '/registry', [
			'methods' => 'GET',
			'permission_callback' => $edit,
			'callback' => [ Controller::class, 'registry' ],
		] );

		register_rest_route( $ns, '/tokens', [
			[
				'methods' => 'GET',
				'permission_callback' => $edit,
				'callback' => [ Controller::class, 'tokens_get' ],
			],
			[
				'methods' => 'PUT',
				'permission_callback' => $manage,
				'callback' => [ Controller::class, 'tokens_save' ],
			],
			[
				'methods' => 'POST',
				'permission_callback' => $manage,
				'callback' => [ Controller::class, 'tokens_save' ],
			],
		] );
		register_rest_route( $ns, '/tokens/presets/(?P<slug>[a-z0-9\-]+)/activate', [
			'methods' => 'POST',
			'permission_callback' => $manage,
			'callback' => [ Controller::class, 'tokens_preset' ],
		] );
		register_rest_route( $ns, '/tokens/presets', [
			'methods' => 'POST',
			'permission_callback' => $manage,
			'callback' => [ Controller::class, 'tokens_preset_save' ],
		] );
		register_rest_route( $ns, '/tokens/presets/(?P<slug>[a-z0-9\-]+)', [
			'methods' => 'DELETE',
			'permission_callback' => $manage,
			'callback' => [ Controller::class, 'tokens_preset_delete' ],
		] );

		register_rest_route( $ns, '/admin-skin', [
			[
				'methods' => 'GET',
				'permission_callback' => $edit,
				'callback' => [ Controller::class, 'admin_skin_get' ],
			],
			[
				'methods' => 'PUT',
				'permission_callback' => $manage,
				'callback' => [ Controller::class, 'admin_skin_save' ],
			],
		] );

		register_rest_route( $ns, '/menus', [
			[
				'methods' => 'GET',
				'permission_callback' => $edit,
				'callback' => [ Controller::class, 'menus_get' ],
			],
			[
				'methods' => 'PUT',
				'permission_callback' => $manage,
				'callback' => [ Controller::class, 'menus_save' ],
			],
			[
				'methods' => 'POST',
				'permission_callback' => $manage,
				'callback' => [ Controller::class, 'menus_save' ],
			],
		] );

		register_rest_route( $ns, '/header', [
			[ 'methods' => 'GET', 'permission_callback' => $edit, 'callback' => [ Controller::class, 'header_get' ] ],
			[ 'methods' => 'PUT', 'permission_callback' => $manage, 'callback' => [ Controller::class, 'header_save' ] ],
			[ 'methods' => 'POST', 'permission_callback' => $manage, 'callback' => [ Controller::class, 'header_save' ] ],
		] );
		register_rest_route( $ns, '/footer', [
			[ 'methods' => 'GET', 'permission_callback' => $edit, 'callback' => [ Controller::class, 'footer_get' ] ],
			[ 'methods' => 'PUT', 'permission_callback' => $manage, 'callback' => [ Controller::class, 'footer_save' ] ],
			[ 'methods' => 'POST', 'permission_callback' => $manage, 'callback' => [ Controller::class, 'footer_save' ] ],
		] );
		register_rest_route( $ns, '/identity', [
			[ 'methods' => 'GET', 'permission_callback' => $edit, 'callback' => [ Controller::class, 'identity_get' ] ],
			[ 'methods' => 'PUT', 'permission_callback' => $manage, 'callback' => [ Controller::class, 'identity_save' ] ],
		] );
		register_rest_route( $ns, '/onboard', [
			'methods'             => 'POST',
			'permission_callback' => $manage,
			'callback'            => [ Controller::class, 'onboard' ],
		] );
		register_rest_route( $ns, '/seo', [
			[ 'methods' => 'GET', 'permission_callback' => $manage, 'callback' => [ Controller::class, 'seo_get' ] ],
			[ 'methods' => 'PUT', 'permission_callback' => $manage, 'callback' => [ Controller::class, 'seo_save' ] ],
		] );
		register_rest_route( $ns, '/settings', [
			[ 'methods' => 'GET', 'permission_callback' => $manage, 'callback' => [ Controller::class, 'settings_get' ] ],
			[ 'methods' => 'PUT', 'permission_callback' => $manage, 'callback' => [ Controller::class, 'settings_save' ] ],
		] );
		register_rest_route( $ns, '/cache/flush', [
			'methods'             => 'POST',
			'permission_callback' => $edit,
			'callback'            => [ Controller::class, 'cache_flush' ],
		] );
		register_rest_route( $ns, '/pages/(?P<id>\d+)/save', [
			'methods'             => 'POST',
			'permission_callback' => $edit,
			'callback'            => [ Controller::class, 'pages_save' ],
		] );

		register_rest_route( $ns, '/globals', [
			[ 'methods' => 'GET', 'permission_callback' => $edit, 'callback' => [ Controller::class, 'globals_list' ] ],
			[ 'methods' => 'POST', 'permission_callback' => $edit, 'callback' => [ Controller::class, 'globals_save' ] ],
		] );
		register_rest_route( $ns, '/globals/(?P<id>\d+)', [
			[ 'methods' => 'PUT', 'permission_callback' => $edit, 'callback' => [ Controller::class, 'globals_update' ] ],
			[ 'methods' => 'DELETE', 'permission_callback' => $edit, 'callback' => [ Controller::class, 'globals_delete' ] ],
		] );
		register_rest_route( $ns, '/templates', [
			[ 'methods' => 'GET', 'permission_callback' => $edit, 'callback' => [ Controller::class, 'templates_list' ] ],
			[ 'methods' => 'POST', 'permission_callback' => $edit, 'callback' => [ Controller::class, 'templates_save' ] ],
		] );
		register_rest_route( $ns, '/templates/(?P<id>\d+)', [
			[ 'methods' => 'DELETE', 'permission_callback' => $edit, 'callback' => [ Controller::class, 'templates_delete' ] ],
		] );

		register_rest_route( $ns, '/blog', [
			[ 'methods' => 'GET', 'permission_callback' => $posts, 'callback' => [ Controller::class, 'blog_list' ] ],
			[ 'methods' => 'POST', 'permission_callback' => $posts, 'callback' => [ Controller::class, 'blog_create' ] ],
		] );
		register_rest_route( $ns, '/blog/(?P<id>\d+)', [
			[ 'methods' => 'GET', 'permission_callback' => $posts, 'callback' => [ Controller::class, 'blog_get' ] ],
			[ 'methods' => 'PUT', 'permission_callback' => $posts, 'callback' => [ Controller::class, 'blog_save' ] ],
			[ 'methods' => 'DELETE', 'permission_callback' => $posts, 'callback' => [ Controller::class, 'blog_delete' ] ],
		] );
		register_rest_route( $ns, '/blog/taxonomies', [
			'methods' => 'GET',
			'permission_callback' => $posts,
			'callback' => [ Controller::class, 'blog_tax' ],
		] );
		$cats = static fn() => current_user_can( 'manage_categories' );
		register_rest_route( $ns, '/blog/terms', [
			'methods' => 'POST',
			'permission_callback' => $cats,
			'callback' => [ Controller::class, 'blog_term' ],
		] );
		register_rest_route( $ns, '/blog/terms/(?P<id>\d+)', [
			[ 'methods' => 'DELETE', 'permission_callback' => $cats, 'callback' => [ Controller::class, 'blog_term_delete' ] ],
		] );
		register_rest_route( $ns, '/blog/(?P<id>\d+)/duplicar', [
			[ 'methods' => 'POST', 'permission_callback' => $posts, 'callback' => [ Controller::class, 'blog_duplicate' ] ],
		] );
		register_rest_route( $ns, '/blog/terms/(?P<id>\d+)/predeterminada', [
			[ 'methods' => 'PUT', 'permission_callback' => $cats, 'callback' => [ Controller::class, 'blog_term_default' ] ],
		] );
		register_rest_route( $ns, '/blog/terms/(?P<id>\d+)/duplicar', [
			[ 'methods' => 'POST', 'permission_callback' => $cats, 'callback' => [ Controller::class, 'blog_term_duplicate' ] ],
		] );
		// El interruptor de «ver las categorias en la web»: lo lee
		// cualquiera que pueda escribir entradas, lo cambia quien
		// administra el tema.
		register_rest_route( $ns, '/blog/settings', [
			[ 'methods' => 'GET', 'permission_callback' => $posts, 'callback' => [ Controller::class, 'blog_settings_get' ] ],
			[ 'methods' => 'PUT', 'permission_callback' => $manage, 'callback' => [ Controller::class, 'blog_settings_save' ] ],
		] );

		register_rest_route( $ns, '/users', [
			[ 'methods' => 'GET', 'permission_callback' => $users, 'callback' => [ Controller::class, 'users_list' ] ],
			[ 'methods' => 'POST', 'permission_callback' => $users, 'callback' => [ Controller::class, 'users_create' ] ],
		] );
		register_rest_route( $ns, '/users/(?P<id>\d+)', [
			[ 'methods' => 'PUT', 'permission_callback' => $users, 'callback' => [ Controller::class, 'users_update' ] ],
			[ 'methods' => 'DELETE', 'permission_callback' => $users, 'callback' => [ Controller::class, 'users_delete' ] ],
		] );
		register_rest_route( $ns, '/roles', [
			[ 'methods' => 'GET', 'permission_callback' => $users, 'callback' => [ Controller::class, 'roles_get' ] ],
			[ 'methods' => 'PUT', 'permission_callback' => $users, 'callback' => [ Controller::class, 'roles_save' ] ],
		] );

		register_rest_route( $ns, '/export', [
			'methods' => 'POST',
			'permission_callback' => $manage,
			'callback' => [ Controller::class, 'export' ],
		] );
		register_rest_route( $ns, '/import', [
			'methods' => 'POST',
			'permission_callback' => $manage,
			'callback' => [ Controller::class, 'import' ],
		] );
	}
}

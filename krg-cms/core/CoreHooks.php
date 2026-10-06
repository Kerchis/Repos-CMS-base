<?php
/**
 * Theme setup hooks.
 *
 * @package Meridian
 */

namespace Meridian;

defined( 'ABSPATH' ) || exit;

class CoreHooks {

	public static function setup(): void {
		load_theme_textdomain( 'meridian', MERIDIAN_PATH . '/languages' );
		add_theme_support( 'title-tag' );
		add_theme_support( 'post-thumbnails' );
		add_theme_support( 'html5', [ 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ] );
		add_theme_support( 'automatic-feed-links' );
		add_theme_support( 'custom-logo', [
			'height'      => 80,
			'width'       => 240,
			'flex-height' => true,
			'flex-width'  => true,
		] );
		add_image_size( 'krg-card', 800, 600, true );
		add_image_size( 'krg-hero', 1600, 900, true );

		\Meridian\Admin\Capabilities::register();
		\Meridian\Components\Registry::boot();
	}

	public static function init(): void {
		\Meridian\Db\Installer::maybe_upgrade();
		\Meridian\Content\PostTypes::register();
		\Meridian\Design\TokenRepository::ensure_defaults();
		\Meridian\Render\Preview::register_query_var();
		\Meridian\Content\Seeder::maybe_library();
		\Meridian\Content\Seeder::maybe_users();
		// Las versiones modernas de las fotos: se preparan al subirlas y
		// se borran con ellas.
		\Meridian\Media\Formats::register();
	}
}

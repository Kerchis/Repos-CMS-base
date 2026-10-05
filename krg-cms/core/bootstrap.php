<?php
/**
 * Boot KRG CMS.
 *
 * @package Meridian
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/constants.php';
require_once __DIR__ . '/autoload.php';

/**
 * Aviso de instalación incompleta.
 *
 * El tema tolera que falte la capa del sistema visual (sigue funcionando con
 * los componentes base), pero conviene avisar en el admin en lugar de dejar
 * que el usuario descubra que faltan componentes.
 */
add_action(
	'admin_notices',
	static function () {
		if ( ! current_user_can( 'switch_themes' ) ) {
			return;
		}
		$required = [
			'core/components/BrandCatalog.php',
			'core/render/BrandRenders.php',
			'core/content/ReferenceSeeder.php',
			'core/design/TokenDefaults.php',
			'admin/assets/js/builder-core.js',
			'assets/css/modules.css',
			'assets/js/modules.js',
			'presets/honeycomb.json',
		];
		$missing = [];
		foreach ( $required as $rel ) {
			if ( ! is_readable( MERIDIAN_PATH . '/' . $rel ) ) {
				$missing[] = $rel;
			}
		}
		if ( ! $missing ) {
			return;
		}
		echo '<div class="notice notice-error"><p><strong>'
			. esc_html__( 'KRG CMS: instalación incompleta.', 'meridian' ) . '</strong> '
			. esc_html__( 'Faltan archivos del sistema visual, así que esos componentes no estarán disponibles. Vuelve a copiar el tema completo:', 'meridian' )
			. '</p><ul style="list-style:disc;margin-left:22px">';
		foreach ( $missing as $rel ) {
			echo '<li><code>' . esc_html( $rel ) . '</code></li>';
		}
		echo '</ul></div>';
	}
);

add_action( 'after_setup_theme', [ \Meridian\CoreHooks::class, 'setup' ] );
add_action( 'init', [ \Meridian\CoreHooks::class, 'init' ] );
add_action( 'rest_api_init', [ \Meridian\Api\Routes::class, 'register' ] );
add_action( 'after_switch_theme', [ \Meridian\Db\Installer::class, 'install' ] );
add_action( 'admin_menu', [ \Meridian\Admin\Menu::class, 'register' ] );
add_action( 'admin_init', [ \Meridian\Admin\Menu::class, 'redirect_legacy' ] );
add_action( 'admin_enqueue_scripts', [ \Meridian\Admin\Assets::class, 'enqueue' ] );
add_action( 'wp_enqueue_scripts', [ \Meridian\PublicAssets::class, 'enqueue' ] );
/*
 * Las fuentes subidas a la Biblioteca de WordPress guardan su direccion
 * entera el dia que se suben. Si el sitio pasa despues a https, esa
 * direccion se queda en http y el navegador bloquea el archivo por
 * contenido mixto: la familia se declara y nunca llega. Esto corrige el
 * esquema al vuelo, tambien en lo que imprime WordPress por su cuenta.
 */
add_filter( 'wp_theme_json_data_user', [ \Meridian\Design\FontCatalog::class, 'secure_theme_json' ] );
add_filter( 'wp_theme_json_data_theme', [ \Meridian\Design\FontCatalog::class, 'secure_theme_json' ] );
add_action( 'wp_head', [ \Meridian\Seo\Head::class, 'output' ], 1 );
add_action( 'admin_init', [ \Meridian\Admin\Capabilities::class, 'maybe_install_caps' ] );
add_filter( 'use_block_editor_for_post_type', [ \Meridian\Admin\Gutenberg::class, 'disable_for_pages' ], 10, 2 );
add_filter( 'show_admin_bar', [ \Meridian\Render\Preview::class, 'maybe_hide_admin_bar' ] );
add_action( 'template_redirect', [ \Meridian\Render\Preview::class, 'guard' ] );
add_action( 'wp_ajax_krg_contact', [ \Meridian\Forms\Contact::class, 'handle' ] );
add_action( 'wp_ajax_nopriv_krg_contact', [ \Meridian\Forms\Contact::class, 'handle' ] );
add_action( 'wp_ajax_meridian_contact', [ \Meridian\Forms\Contact::class, 'handle' ] );
add_action( 'wp_ajax_nopriv_meridian_contact', [ \Meridian\Forms\Contact::class, 'handle' ] );
add_action(
	'wp',
	static function () {
		if ( is_front_page() || is_page() ) {
			$id = get_queried_object_id();
			if ( $id && \Meridian\Render\PageRenderer::post_has_document( $id ) ) {
				\Meridian\Render\PageRenderer::prime( $id );
			}
		}
		if ( is_home() ) {
			$id = (int) get_option( 'page_for_posts' );
			if ( $id && \Meridian\Render\PageRenderer::post_has_document( $id ) ) {
				\Meridian\Render\PageRenderer::prime( $id );
			}
		}
	}
);
add_action( 'template_redirect', [ \Meridian\Seo\Sitemap::class, 'maybe_output' ], 0 );
add_filter( 'robots_txt', [ \Meridian\Seo\Head::class, 'robots_txt' ], 10, 2 );
add_filter( 'document_title_separator', [ \Meridian\Seo\Head::class, 'title_separator' ] );
add_filter( 'body_class', static function ( $classes ) {
	if ( \Meridian\Render\Preview::is_preview() ) {
		$classes[] = 'krg-preview';
	}
	// El andamiaje del editor —contornos, avisos de hueco vacio, la
	// seleccion al hacer clic— solo se pinta en el lienzo del
	// constructor. La pestana «Preview» es la pagina publica.
	if ( \Meridian\Render\Preview::is_canvas() ) {
		$classes[] = 'krg-canvas';
	}
	return $classes;
} );
add_filter(
	'document_title_parts',
	static function ( $parts ) {
		$doc = \Meridian\Render\PageRenderer::current_document();
		if ( is_page() && ! $doc ) {
			$id = get_queried_object_id();
			if ( $id ) {
				$doc = \Meridian\Content\PageRepository::get( $id, \Meridian\Render\Preview::is_preview() ? 'draft' : 'published' );
			}
		}
		if ( is_array( $doc ) && ! empty( $doc['seo']['title'] ) ) {
			$parts['title'] = $doc['seo']['title'];
		}
		return $parts;
	}
);

// CoreHooks lives as Meridian\CoreHooks in core/CoreHooks.php

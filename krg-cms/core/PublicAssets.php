<?php
/**
 * Public assets.
 *
 * @package Meridian
 */

namespace Meridian;

defined( 'ABSPATH' ) || exit;

class PublicAssets {

	public static function enqueue(): void {
		wp_enqueue_style( 'krg-base', MERIDIAN_URI . '/assets/css/base.css', [], MERIDIAN_VERSION );
		wp_enqueue_style( 'krg-components', MERIDIAN_URI . '/assets/css/components.css', [ 'krg-base' ], MERIDIAN_VERSION );
		// Capa del sistema visual de referencia: siempre después de components.css.
		wp_enqueue_style( 'krg-modules', MERIDIAN_URI . '/assets/css/modules.css', [ 'krg-components' ], MERIDIAN_VERSION );
		\Meridian\Design\FontCatalog::enqueue_used();

		wp_add_inline_style( 'krg-base', \Meridian\Design\TokenCompiler::css() );
		wp_add_inline_style( 'krg-base', \Meridian\Cache\DocumentCache::chrome_css() );

		$doc     = \Meridian\Render\PageRenderer::current_document();
		$post_id = get_queried_object_id();
		$sum     = is_array( $doc ) ? (string) ( $doc['checksum'] ?? '' ) : '';
		$doc_css = ( $post_id && $sum ) ? \Meridian\Cache\DocumentCache::css( $post_id, $sum ) : null;
		if ( null === $doc_css ) {
			$doc_css = \Meridian\Style\DocumentCssCompiler::for_current_request();
		}
		if ( $doc_css ) {
			wp_add_inline_style( 'krg-components', $doc_css );
		}

		$types = is_array( $doc ) ? \Meridian\Media\Prefetch::types( $doc['sections'] ?? [] ) : [];
		wp_enqueue_script( 'krg-public', MERIDIAN_URI . '/assets/js/public.js', [], MERIDIAN_VERSION, true );
		wp_enqueue_script( 'krg-modules', MERIDIAN_URI . '/assets/js/modules.js', [ 'krg-public' ], MERIDIAN_VERSION, true );
		wp_localize_script(
			'krg-public',
			'KrgPublic',
			[
				'ajax'  => admin_url( 'admin-ajax.php' ),
				'nonce' => wp_create_nonce( 'krg_public' ),
				'i18n'  => [
					'sending' => __( 'Enviando…', 'meridian' ),
					'sent'    => __( 'Mensaje enviado. Gracias.', 'meridian' ),
					'error'   => __( 'No se pudo enviar el mensaje.', 'meridian' ),
				],
			]
		);

		// El guion de seleccion se queda en el lienzo del constructor.
		// Captura todos los clics para poder elegir bloques, asi que en
		// la pestana «Preview» dejaba la pagina muerta: ni enlaces ni
		// botones. Y «Preview» tiene que comportarse como la web.
		if ( \Meridian\Render\Preview::is_canvas() ) {
			wp_enqueue_script( 'krg-preview', MERIDIAN_URI . '/assets/js/preview.js', [], MERIDIAN_VERSION, true );
		}

		if ( ! empty( $types['map'] ) ) {
			wp_enqueue_script( 'krg-maps', MERIDIAN_URI . '/assets/js/maps.js', [ 'krg-public' ], MERIDIAN_VERSION, true );
		}
		if ( ! empty( $types['everest-form'] ) && class_exists( '\EVF_Frontend_Scripts' ) && method_exists( '\EVF_Frontend_Scripts', 'load_scripts' ) ) {
			\EVF_Frontend_Scripts::load_scripts();
		}
	}
}

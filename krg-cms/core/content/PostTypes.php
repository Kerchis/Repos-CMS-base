<?php
/**
 * Custom post types.
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

class PostTypes {

	public static function register(): void {
		register_post_type(
			'meridian_global',
			[
				'label'        => __( 'Componentes globales', 'meridian' ),
				'public'       => false,
				'show_ui'      => false,
				'show_in_rest' => false,
				'supports'     => [ 'title' ],
			]
		);
		register_post_type(
			'meridian_template',
			[
				'label'        => __( 'Plantillas', 'meridian' ),
				'public'       => false,
				'show_ui'      => false,
				'show_in_rest' => false,
				'supports'     => [ 'title' ],
			]
		);
		// Las reservas de mesa. Privadas: no son contenido de la web,
		// no tienen dirección propia y no las ve ningún buscador. Se
		// leen desde la pantalla «Reservas» del CMS.
		register_post_type(
			\Meridian\Forms\BookingStore::TIPO,
			[
				'label'               => __( 'Reservas', 'meridian' ),
				'public'              => false,
				'publicly_queryable'  => false,
				'exclude_from_search' => true,
				'show_ui'             => false,
				'show_in_rest'        => false,
				'supports'            => [ 'title' ],
			]
		);
	}
}

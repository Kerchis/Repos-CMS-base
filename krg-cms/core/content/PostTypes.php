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
	}
}

<?php
/**
 * Single post.
 *
 * @package Meridian
 */

defined( 'ABSPATH' ) || exit;

get_header();

if ( have_posts() ) {
	the_post();
	$subtitle = get_post_meta( get_the_ID(), '_meridian_subtitle', true );
	echo '<main class="m-main"><article class="m-container m-article">';
	echo '<p class="m-eyebrow">' . esc_html( get_the_date() ) . '</p>';
	echo '<h1 class="m-role-h1">' . esc_html( get_the_title() ) . '</h1>';
	if ( $subtitle ) {
		echo '<p class="m-hero-sub">' . esc_html( $subtitle ) . '</p>';
	}
	if ( has_post_thumbnail() ) {
		echo '<figure class="m-figure is-radius-lg">' . get_the_post_thumbnail( get_the_ID(), 'large', [ 'class' => 'm-img' ] ) . '</figure>';
	}
	echo '<div class="m-rich m-article-body">';
	the_content();
	echo '</div>';
	// Las categorias y las etiquetas al pie del articulo solo se
	// imprimen si el interruptor de la pantalla de Blog las deja ver.
	// Apagado, no basta con esconder el modulo de categorias: aqui
	// tambien habia enlaces a los archivos de cada termino.
	if ( \Meridian\Content\BlogSettings::show_categories() ) {
		echo '<nav class="m-article-meta">';
		the_category( ', ' );
		echo ' ';
		the_tags( '', ', ' );
		echo '</nav>';
	}
	$ctx  = new \Meridian\Render\RenderContext();
	$node = [ 'id' => 'related', 'type' => 'related-posts', 'visible' => true ];
	echo \Meridian\Render\ComponentRenders::related_posts( $node, [ 'count' => 3 ], '', $ctx ); // phpcs:ignore
	echo '</article></main>';
}

get_footer();

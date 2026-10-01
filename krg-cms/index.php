<?php
/**
 * Fallback index.
 *
 * @package Meridian
 */

defined( 'ABSPATH' ) || exit;

get_header();

if ( have_posts() ) {
	echo '<main class="m-main m-container">';
	while ( have_posts() ) {
		the_post();
		if ( \Meridian\Render\PageRenderer::post_has_document( get_the_ID() ) ) {
			echo \Meridian\Render\PageRenderer::for_post( get_the_ID() ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		} else {
			echo '<article class="m-legacy">';
			echo '<h1>' . esc_html( get_the_title() ) . '</h1>';
			the_content();
			echo '</article>';
		}
	}
	echo '</main>';
} else {
	echo '<main class="m-main m-container"><p>' . esc_html__( 'No hay contenido todavía.', 'meridian' ) . '</p></main>';
}

get_footer();

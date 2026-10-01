<?php
defined( 'ABSPATH' ) || exit;
get_header();
echo '<main class="m-main"><div class="m-container">';
echo '<h1 class="m-role-h1">' . esc_html__( 'Resultados', 'meridian' ) . '</h1>';
if ( have_posts() ) {
	echo '<ul class="m-search-list">';
	while ( have_posts() ) {
		the_post();
		echo '<li><a href="' . esc_url( get_permalink() ) . '">' . esc_html( get_the_title() ) . '</a></li>';
	}
	echo '</ul>';
	the_posts_pagination();
} else {
	echo '<p>' . esc_html__( 'No hay resultados.', 'meridian' ) . '</p>';
}
echo '</div></main>';
get_footer();

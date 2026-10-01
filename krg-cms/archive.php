<?php
defined( 'ABSPATH' ) || exit;
get_header();
echo '<main class="m-main"><div class="m-container">';
the_archive_title( '<h1 class="m-role-h1">', '</h1>' );
the_archive_description( '<p class="m-hero-sub">', '</p>' );
if ( have_posts() ) {
	echo '<div class="m-grid m-blog-fallback">';
	while ( have_posts() ) {
		the_post();
		echo '<article class="m-card"><a class="m-card-link" href="' . esc_url( get_permalink() ) . '"><div class="m-card-body">';
		echo '<h3>' . esc_html( get_the_title() ) . '</h3><p>' . esc_html( get_the_excerpt() ) . '</p></div></a></article>';
	}
	echo '</div>';
	the_posts_pagination();
}
echo '</div></main>';
get_footer();

<?php
/**
 * Blog index (page_for_posts).
 *
 * @package Meridian
 */

defined( 'ABSPATH' ) || exit;

get_header();

$blog_id = (int) get_option( 'page_for_posts' );
echo '<main class="m-main">';
if ( $blog_id && \Meridian\Render\PageRenderer::post_has_document( $blog_id ) ) {
	echo \Meridian\Render\PageRenderer::for_post( $blog_id ); // phpcs:ignore
} else {
	echo '<div class="m-container"><h1>' . esc_html__( 'Blog', 'meridian' ) . '</h1>';
	if ( have_posts() ) {
		echo '<div class="m-grid m-blog-fallback">';
		while ( have_posts() ) {
			the_post();
			echo '<article class="m-card"><a class="m-card-link" href="' . esc_url( get_permalink() ) . '">';
			the_post_thumbnail( 'meridian-card', [ 'class' => 'm-card-img' ] );
			echo '<div class="m-card-body"><h3>' . esc_html( get_the_title() ) . '</h3><p>' . esc_html( get_the_excerpt() ) . '</p></div></a></article>';
		}
		echo '</div>';
		the_posts_pagination();
	}
	echo '</div>';
}
echo '</main>';

get_footer();

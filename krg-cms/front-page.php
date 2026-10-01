<?php
/**
 * Front page.
 *
 * @package Meridian
 */

defined( 'ABSPATH' ) || exit;

get_header();

if ( have_posts() ) {
	the_post();
	echo '<main class="m-main">';
	if ( post_password_required() ) {
		echo '<div class="m-container m-password">' . get_the_password_form() . '</div>'; // phpcs:ignore
	} elseif ( \Meridian\Render\PageRenderer::post_has_document( get_the_ID() ) ) {
		echo \Meridian\Render\PageRenderer::for_post( get_the_ID() ); // phpcs:ignore
	} else {
		the_content();
	}
	echo '</main>';
}

get_footer();

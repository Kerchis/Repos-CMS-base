<?php
defined( 'ABSPATH' ) || exit;
get_header();
echo '<main class="m-main"><div class="m-container m-align-center" style="padding:var(--spacing-section) 0">';
echo '<p class="m-eyebrow">404</p>';
echo '<h1 class="m-role-h1">' . esc_html__( 'Página no encontrada', 'meridian' ) . '</h1>';
echo '<p>' . esc_html__( 'La URL no existe o fue movida.', 'meridian' ) . '</p>';
echo '<a class="m-btn m-btn-primary" href="' . esc_url( home_url( '/' ) ) . '">' . esc_html__( 'Volver al inicio', 'meridian' ) . '</a>';
echo '</div></main>';
get_footer();

<?php
defined( 'ABSPATH' ) || exit;
?>
<form role="search" method="get" class="search-form" action="<?php echo esc_url( home_url( '/' ) ); ?>">
	<label>
		<span class="screen-reader-text"><?php esc_html_e( 'Buscar', 'meridian' ); ?></span>
		<input type="search" name="s" placeholder="<?php esc_attr_e( 'Buscar…', 'meridian' ); ?>" value="<?php echo esc_attr( get_search_query() ); ?>">
	</label>
	<button class="search-submit m-btn m-btn-primary" type="submit"><?php esc_html_e( 'Buscar', 'meridian' ); ?></button>
</form>

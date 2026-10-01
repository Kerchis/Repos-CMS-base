<?php
/**
 * Public header.
 *
 * @package Meridian
 */

defined( 'ABSPATH' ) || exit;

?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'krg-root' ); ?>>
<?php wp_body_open(); ?>
<a class="m-skip" href="#contenido"><?php esc_html_e( 'Saltar al contenido', 'meridian' ); ?></a>
<?php
$doc = \Meridian\Render\PageRenderer::current_document();
$show_header = ! $doc || ! empty( $doc['settings']['showHeader'] );
if ( $show_header ) {
	$h        = \Meridian\Navigation\Menus::header();
	$identity = \Meridian\Navigation\Menus::identity();
	$sticky   = ! empty( $h['sticky'] ) ? ' is-sticky' : '';
	// Cabecera adaptativa: `text` cambia solo el color; `full` también el fondo.
	$adaptive = sanitize_key( (string) ( $h['adaptive'] ?? 'off' ) );
	$adaptive = in_array( $adaptive, [ 'text', 'full' ], true ) ? $adaptive : '';
	$trans    = ! empty( $h['transparent'] ) ? ' is-transparent' : '';
	$align_k  = $h['align'] ?? 'left';
	$align    = 'center' === $align_k ? ' is-center' : ( 'right' === $align_k ? ' is-right' : '' );
	$anim_k   = sanitize_key( (string) ( $h['animation'] ?? 'none' ) );
	$anim     = ( $anim_k && 'none' !== $anim_k ) ? ' m-anim-' . $anim_k : '';
	$extra    = $h['htmlClass'] ?? '';
	$op       = max( 0, min( 100, absint( $h['transOpacity'] ?? 0 ) ) );
	$blend    = \Meridian\Navigation\Menus::blend_mode( (string) ( $h['transBlend'] ?? 'normal' ) );
	$blur     = max( 0, min( 40, absint( $h['transBlur'] ?? 20 ) ) );
	$glass    = sanitize_text_field( (string) ( $h['transColor'] ?? '#ffffff' ) );
	$fg       = sanitize_text_field( (string) ( $h['color'] ?? 'var(--color-text)' ) );
	$hbg      = sanitize_text_field( (string) ( $h['background'] ?? '' ) );
	$nhfg     = sanitize_text_field( (string) ( $h['navHoverFg'] ?? '' ) ) ?: 'var(--color-primary)';
	$nhbg     = sanitize_text_field( (string) ( $h['navHoverBg'] ?? '' ) ) ?: 'transparent';
	$logo_id  = (int) ( $h['logoId'] ?: $identity['logoId'] );
	$logo_m   = (int) ( $h['logoMobile'] ?: $logo_id );
	$width    = max( 16, min( 480, absint( $h['logoWidth'] ?? 140 ) ) );
	$wt       = max( 16, min( 480, absint( $h['logoWidthTablet'] ?? $width ) ) );
	$wm       = max( 16, min( 480, absint( $h['logoWidthMobile'] ?? 120 ) ) );
	$hstyle   = '--m-header-fg:' . esc_attr( $fg )
		. ';--m-header-bg:' . esc_attr( $hbg ?: 'var(--color-background)' )
		. ';--m-header-op:' . $op . '%;--m-header-blend:' . esc_attr( $blend )
		. ';--m-header-blur:' . $blur . 'px;--m-header-glass:' . esc_attr( $glass ?: '#ffffff' )
		. ';--m-logo-w:' . $width . 'px;--m-logo-w-tablet:' . $wt . 'px;--m-logo-w-mobile:' . $wm . 'px'
		. ';--m-nav-hover-fg:' . esc_attr( $nhfg )
		. ';--m-nav-hover-bg:' . esc_attr( $nhbg );
	if ( ! empty( $h['animDuration'] ) ) {
		$hstyle .= ';animation-duration:' . absint( $h['animDuration'] ) . 'ms';
	}
	if ( ! empty( $h['animDelay'] ) ) {
		$hstyle .= ';animation-delay:' . absint( $h['animDelay'] ) . 'ms';
	}
	$name     = $identity['siteName'] ?: get_bloginfo( 'name' );
	$logo_href = \Meridian\Navigation\Menus::logo_href( $h );
	$chrome = \Meridian\Render\Preview::is_preview() ? ' data-krg-chrome="header"' : '';
	$dist   = ( $h['distribute'] ?? '' ) === 'x' ? ' is-dist-x' : ( ( $h['distribute'] ?? '' ) === 'y' ? ' is-dist-y' : '' );
	$nav_d  = \Meridian\Navigation\Menus::nav_mode( $h['navModeDesktop'] ?? 'bar', 'bar' );
	$nav_t  = \Meridian\Navigation\Menus::nav_mode( $h['navModeTablet'] ?? 'bar', 'bar' );
	$nav_m  = \Meridian\Navigation\Menus::nav_mode( $h['navModeMobile'] ?? 'drawer', 'drawer' );
	?>
	<header class="m-site-header<?php echo esc_attr( $sticky . $trans . $align . $anim . $dist . ( $adaptive ? ' is-adaptive' : '' ) . ( $extra ? ' ' . $extra : '' ) ); ?>"<?php echo $adaptive ? ' data-adaptive="' . esc_attr( $adaptive ) . '"' : ''; ?> data-nav-d="<?php echo esc_attr( $nav_d ); ?>" data-nav-t="<?php echo esc_attr( $nav_t ); ?>" data-nav-m="<?php echo esc_attr( $nav_m ); ?>"<?php echo ( $anim_k && 'none' !== $anim_k ) ? ' data-anim-in="' . esc_attr( $anim_k ) . '"' : ''; ?><?php echo ! empty( $h['htmlId'] ) ? ' id="' . esc_attr( $h['htmlId'] ) . '"' : ''; ?> style="<?php echo esc_attr( $hstyle ); ?>"<?php echo $chrome; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
		<?php if ( $trans ) : ?>
			<div class="m-header-glass" aria-hidden="true"></div>
		<?php endif; ?>
		<div class="m-container m-header-inner">
			<a class="m-logo" href="<?php echo esc_url( $logo_href ); ?>">
				<?php
				if ( $logo_id ) {
					echo '<span class="m-logo-desktop">';
					echo wp_get_attachment_image( $logo_id, 'full', false, [ 'alt' => esc_attr( $name ) ] );
					echo '</span>';
					echo '<span class="m-logo-mobile">';
					echo wp_get_attachment_image( $logo_m, 'full', false, [ 'alt' => esc_attr( $name ) ] );
					echo '</span>';
				} else {
					echo '<span class="m-logo-text">' . esc_html( $name ) . '</span>';
				}
				?>
			</a>
			<button class="m-nav-toggle" type="button" aria-expanded="false" aria-controls="m-nav"><?php esc_html_e( 'Menú', 'meridian' ); ?></button>
			<nav id="m-nav" class="m-header-nav" aria-label="<?php esc_attr_e( 'Principal', 'meridian' ); ?>">
				<?php
				$page_menu = ( is_array( $doc ) && ! empty( $doc['settings']['headerMenu'] ) ) ? sanitize_key( (string) $doc['settings']['headerMenu'] ) : '';
				$menu_slug = $page_menu !== '' ? $page_menu : ( $h['menuSlug'] ?? 'header' );
				echo \Meridian\Navigation\Menus::render( $menu_slug ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				if ( ! empty( $h['ctaText'] ) ) {
					echo '<a class="m-btn m-btn-primary m-header-cta m-header-cta-in" href="' . esc_url( $h['ctaUrl'] ?: '#' ) . '">' . esc_html( $h['ctaText'] ) . '</a>';
				}
				?>
			</nav>
			<?php if ( ! empty( $h['ctaText'] ) ) : ?>
				<a class="m-btn m-btn-primary m-header-cta m-header-cta-out" href="<?php echo esc_url( $h['ctaUrl'] ?: '#' ); ?>"><?php echo esc_html( $h['ctaText'] ); ?></a>
			<?php endif; ?>
		</div>
	</header>
	<?php
}
?>
<div id="contenido" class="m-page">

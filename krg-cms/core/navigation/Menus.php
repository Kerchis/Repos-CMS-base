<?php
/**
 * Menus, header, footer documents.
 *
 * @package Meridian
 */

namespace Meridian\Navigation;

defined( 'ABSPATH' ) || exit;

class Menus {

	public static function all(): array {
		$menus = get_option( MERIDIAN_OPTION_MENUS, [] );
		if ( ! is_array( $menus ) || ! $menus ) {
			$menus = self::defaults();
			update_option( MERIDIAN_OPTION_MENUS, $menus, false );
		}
		return $menus;
	}

	public static function save( array $menus ): array {
		$clean = [];
		foreach ( $menus as $menu ) {
			if ( ! is_array( $menu ) ) {
				continue;
			}
			$clean[] = [
				'slug'  => sanitize_key( $menu['slug'] ?? 'menu' ),
				'name'  => sanitize_text_field( $menu['name'] ?? '' ),
				'items' => self::items( $menu['items'] ?? [] ),
			];
		}
		update_option( MERIDIAN_OPTION_MENUS, $clean, false );
		\Meridian\Cache\DocumentCache::flush_chrome();
		return $clean;
	}

	public static function items( array $items ): array {
		$out = [];
		foreach ( $items as $it ) {
			if ( ! is_array( $it ) ) {
				continue;
			}
			$out[] = [
				'id'      => sanitize_text_field( $it['id'] ?? wp_generate_uuid4() ),
				'label'   => sanitize_text_field( $it['label'] ?? '' ),
				'type'    => ( $it['type'] ?? 'internal' ) === 'external' ? 'external' : 'internal',
				'pageId'  => absint( $it['pageId'] ?? 0 ),
				'url'     => \Meridian\Security\UrlValidator::sanitize( $it['url'] ?? '' ),
				'target'  => ( $it['target'] ?? '_self' ) === '_blank' ? '_blank' : '_self',
				'visible' => array_key_exists( 'visible', $it ) ? (bool) $it['visible'] : true,
				'children'=> self::items( $it['children'] ?? [] ),
			];
		}
		return $out;
	}

	public static function by_slug( string $slug ): array {
		foreach ( self::all() as $m ) {
			if ( ( $m['slug'] ?? '' ) === $slug ) {
				return $m;
			}
		}
		return [ 'slug' => $slug, 'name' => $slug, 'items' => [] ];
	}

	public static function render( string $slug, int $depth = 0 ): string {
		$menu = self::by_slug( $slug );
		return self::render_items( $menu['items'] ?? [], $depth );
	}

	public static function render_items( array $items, int $depth = 0 ): string {
		if ( ! $items ) {
			return '';
		}
		$html = '<ul class="m-nav-list' . ( $depth ? ' m-nav-sub' : '' ) . '">';
		foreach ( $items as $it ) {
			if ( empty( $it['visible'] ) ) {
				continue;
			}
			$url  = trim( (string) ( $it['url'] ?? '' ) );
			$hash = '';
			if ( str_contains( $url, '#' ) ) {
				$parts = explode( '#', $url, 2 );
				$url   = $parts[0];
				$hash  = '#' . ( $parts[1] ?? '' );
			}
			if ( $hash && ( $url === '' || $url === '/' ) ) {
				$url = $hash;
			} elseif ( ( $it['type'] ?? 'internal' ) === 'internal' && ! empty( $it['pageId'] ) ) {
				$perma = get_permalink( (int) $it['pageId'] );
				if ( $perma ) {
					$url = $perma . $hash;
				}
			} elseif ( $hash && $url !== '' ) {
				$url .= $hash;
			} elseif ( $hash ) {
				$url = $hash;
			}
			$current = ( $url && untrailingslashit( $url ) === untrailingslashit( home_url( add_query_arg( [] ) ) ) );
			$li      = $current ? ' class="is-current"' : '';
			$target  = ( $it['target'] ?? '_self' ) === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
			$html   .= '<li' . $li . '><a href="' . esc_url( $url ?: '#' ) . '"' . $target . '>' . esc_html( $it['label'] ?? '' ) . '</a>';
			if ( ! empty( $it['children'] ) ) {
				$html .= self::render_items( $it['children'], $depth + 1 );
			}
			$html .= '</li>';
		}
		$html .= '</ul>';
		return $html;
	}

	public static function defaults(): array {
		$home = (int) get_option( 'page_on_front' );
		$pages = get_posts(
			[
				'post_type'      => 'page',
				'post_status'    => 'publish',
				'posts_per_page' => 8,
				'orderby'        => 'menu_order',
				'order'          => 'ASC',
			]
		);
		$items = [];
		foreach ( $pages as $p ) {
			$items[] = [
				'id'      => 'itm_' . $p->ID,
				'label'   => $p->post_title,
				'type'    => 'internal',
				'pageId'  => $p->ID,
				'url'     => '',
				'target'  => '_self',
				'visible' => true,
				'children'=> [],
			];
		}
		return [
			[
				'slug'  => 'header',
				'name'  => __( 'Header', 'meridian' ),
				'items' => $items,
			],
			[
				'slug'  => 'footer',
				'name'  => __( 'Footer', 'meridian' ),
				'items' => $items,
			],
			[
				'slug'  => 'secondary',
				'name'  => __( 'Secundario', 'meridian' ),
				'items' => [],
			],
		];
	}

	public static function header(): array {
		$h = get_option( MERIDIAN_OPTION_HEADER );
		if ( ! is_array( $h ) ) {
			$h = self::default_header();
			update_option( MERIDIAN_OPTION_HEADER, $h, false );
		}
		return self::with_logo_urls( wp_parse_args( $h, self::default_header() ) );
	}

	public static function with_logo_urls( array $h ): array {
		$desk = ! empty( $h['logoId'] ) ? wp_get_attachment_image_url( (int) $h['logoId'], 'full' ) : '';
		$mob  = ! empty( $h['logoMobile'] ) ? wp_get_attachment_image_url( (int) $h['logoMobile'], 'full' ) : '';
		$h['logoSrc']       = is_string( $desk ) ? $desk : '';
		$h['logoMobileSrc'] = is_string( $mob ) && $mob !== '' ? $mob : $h['logoSrc'];
		return $h;
	}

	public static function footer(): array {
		$h = get_option( MERIDIAN_OPTION_FOOTER );
		if ( ! is_array( $h ) ) {
			$h = self::default_footer();
			update_option( MERIDIAN_OPTION_FOOTER, $h, false );
		}
		$h = wp_parse_args( $h, self::default_footer() );
		if ( empty( $h['sections'] ) || ! is_array( $h['sections'] ) ) {
			$h['sections'] = [ self::classic_section( $h ) ];
			update_option( MERIDIAN_OPTION_FOOTER, $h, false );
			\Meridian\Cache\DocumentCache::flush_chrome();
		}
		return $h;
	}

	/**
	 * El rótulo de la marca de una cabecera o de un pie.
	 *
	 * Sale del campo `logoText`, que se edita en el panel. Si está vacío
	 * —porque alguien lo borró a propósito para dejar sólo el logo— se
	 * devuelve cadena vacía y quien pinta decide: el texto no se imprime
	 * y el `alt` de la imagen cae en el nombre del sitio, que ahí sí es
	 * lo correcto para quien no ve el logo.
	 */
	public static function marca( array $ajustes ): string {
		$marca = trim( (string) ( $ajustes['logoText'] ?? '' ) );
		return '' !== $marca ? $marca : (string) get_bloginfo( 'name' );
	}

	private static function fnode( string $type, array $props = [], array $children = [], string $name = '' ): array {
		return [
			'id'         => 'n_' . wp_generate_uuid4(),
			'type'       => $type,
			'name'       => $name !== '' ? $name : $type,
			'visible'    => true,
			'source'     => 'local',
			'props'      => $props,
			'styles'     => [ 'desktop' => [], 'tablet' => [], 'mobile' => [] ],
			'children'   => $children,
			'animation'  => 'none',
			'htmlId'     => '',
			'htmlClass'  => '',
		];
	}

	public static function classic_section( array $f ): array {
		$logo_id = absint( $f['logoId'] ?? 0 );
		$col1    = [];
		if ( $logo_id ) {
			$col1[] = self::fnode(
				'image',
				[
					'imageId'   => $logo_id,
					'fillMode'  => 'natural',
					'objectFit' => 'contain',
					'alt'       => self::marca( $f ),
				],
				[],
				__( 'Logo', 'meridian' )
			);
			$col1[0]['styles']['desktop']['max-width'] = '180px';
			$col1[0]['styles']['desktop']['width']     = '180px';
		} else {
			$marca = trim( (string) ( $f['logoText'] ?? '' ) );
			if ( '' !== $marca ) {
				$col1[] = self::fnode( 'heading', [ 'text' => $marca, 'tag' => 'h2' ], [], __( 'Logo', 'meridian' ) );
			}
		}
		if ( ! empty( $f['text'] ) ) {
			$col1[] = self::fnode( 'paragraph', [ 'text' => (string) $f['text'] ], [], __( 'Texto', 'meridian' ) );
		}
		$social = [];
		foreach ( $f['social'] ?? [] as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$social[] = [
				'q' => sanitize_text_field( $row['label'] ?? '' ),
				'a' => (string) ( $row['url'] ?? '' ),
			];
		}
		if ( $social ) {
			$col1[] = self::fnode( 'social-links', [ 'items' => $social ], [], __( 'Redes', 'meridian' ) );
		}
		$col2 = [
			self::fnode( 'menu', [ 'slug' => sanitize_key( $f['menuSlug'] ?? 'footer' ) ], [], __( 'Menú', 'meridian' ) ),
		];
		$col3 = [];
		if ( ! empty( $f['extraTitle'] ) ) {
			$col3[] = self::fnode( 'heading', [ 'text' => (string) $f['extraTitle'], 'tag' => 'h3' ], [], __( 'Título', 'meridian' ) );
		}
		if ( ! empty( $f['extraText'] ) ) {
			$col3[] = self::fnode( 'paragraph', [ 'text' => (string) $f['extraText'] ], [], __( 'Texto extra', 'meridian' ) );
		}
		if ( ! empty( $f['showSearch'] ) ) {
			$col3[] = self::fnode( 'search-form', [], [], __( 'Buscador', 'meridian' ) );
		}
		if ( ! $col3 ) {
			$col3[] = self::fnode( 'paragraph', [ 'text' => '' ], [], __( 'Columna', 'meridian' ) );
		}
		$row = self::fnode(
			'row',
			[ 'layout' => '4-5-3', 'gap' => 32, 'vAlign' => 'start' ],
			[
				self::fnode( 'column', [ 'span' => 4, 'spanTablet' => 6, 'spanMobile' => 12 ], $col1, __( 'Columna 1', 'meridian' ) ),
				self::fnode( 'column', [ 'span' => 5, 'spanTablet' => 6, 'spanMobile' => 12 ], $col2, __( 'Columna 2', 'meridian' ) ),
				self::fnode( 'column', [ 'span' => 3, 'spanTablet' => 12, 'spanMobile' => 12 ], $col3, __( 'Columna 3', 'meridian' ) ),
			],
			__( 'Fila', 'meridian' )
		);
		return self::fnode(
			'section',
			[ 'fullWidth' => false, 'background' => '' ],
			[ $row ],
			__( 'Pie', 'meridian' )
		);
	}

	public static function save_header( array $data ): array {
		$data = array_merge(
			self::default_header(),
			[
				'logoId'      => absint( $data['logoId'] ?? 0 ),
				'logoMobile'  => absint( $data['logoMobile'] ?? 0 ),
				'logoWidth'         => max( 16, min( 480, absint( $data['logoWidth'] ?? 140 ) ) ),
				'logoWidthTablet'   => max( 16, min( 480, absint( $data['logoWidthTablet'] ?? ( $data['logoWidth'] ?? 140 ) ) ) ),
				'logoWidthMobile'   => max( 16, min( 480, absint( $data['logoWidthMobile'] ?? 120 ) ) ),
				'adaptive'    => in_array( sanitize_key( (string) ( $data['adaptive'] ?? 'off' ) ), [ 'off', 'text', 'full' ], true )
					? sanitize_key( (string) ( $data['adaptive'] ?? 'off' ) )
					: 'off',
				'sticky'      => ! empty( $data['sticky'] ),
				'logoText'    => sanitize_text_field( $data['logoText'] ?? '' ),
				'ctaText'     => sanitize_text_field( $data['ctaText'] ?? '' ),
				'ctaUrl'      => \Meridian\Security\UrlValidator::sanitize( $data['ctaUrl'] ?? '' ),
				'menuSlug'    => sanitize_key( $data['menuSlug'] ?? 'header' ),
				'height'      => max( 48, absint( $data['height'] ?? 72 ) ),
				'paddingY'    => max( 0, absint( $data['paddingY'] ?? 12 ) ),
			'transparent'   => ! empty( $data['transparent'] ),
			'transOpacity'  => max( 0, min( 100, absint( $data['transOpacity'] ?? 0 ) ) ),
			'transBlend'    => self::blend_mode( $data['transBlend'] ?? 'normal' ),
			'transBlur'     => max( 0, min( 40, absint( $data['transBlur'] ?? 20 ) ) ),
			'transColor'    => sanitize_text_field( $data['transColor'] ?? '#ffffff' ),
			'logoRadius'    => self::corner_radius_key( $data['logoRadius'] ?? 'none' ),
			'navHoverFg'    => sanitize_text_field( $data['navHoverFg'] ?? '' ),
			'navHoverBg'    => sanitize_text_field( $data['navHoverBg'] ?? '' ),
			'logoLink'      => in_array( $data['logoLink'] ?? 'home', [ 'home', 'section', 'url' ], true ) ? $data['logoLink'] : 'home',
			'logoUrl'       => ( static function ( array $data ): string {
				$raw = trim( (string) ( $data['logoUrl'] ?? '' ) );
				if ( ( $data['logoLink'] ?? '' ) === 'section' || str_starts_with( $raw, '#' ) ) {
					$id = sanitize_html_class( ltrim( $raw, '#' ) );
					return $id !== '' ? '#' . $id : '';
				}
				return \Meridian\Security\UrlValidator::sanitize( $raw );
			} )( $data ),
			'align'       => in_array( $data['align'] ?? 'left', [ 'left', 'center', 'right' ], true ) ? $data['align'] : 'left',
			'vAlign'      => in_array( $data['vAlign'] ?? 'center', [ 'start', 'center', 'end' ], true ) ? $data['vAlign'] : 'center',
			'htmlId'      => sanitize_html_class( (string) ( $data['htmlId'] ?? '' ) ),
			'htmlClass'   => sanitize_text_field( $data['htmlClass'] ?? '' ),
			'animation'   => in_array( $data['animation'] ?? 'none', [ 'none', 'fade', 'slide', 'zoom', 'bounce', 'flip' ], true ) ? $data['animation'] : 'none',
			'animDuration'=> max( 0, min( 3000, absint( $data['animDuration'] ?? 600 ) ) ),
			'animDelay'   => max( 0, min( 3000, absint( $data['animDelay'] ?? 0 ) ) ),
			'distribute'  => in_array( $data['distribute'] ?? 'none', [ 'none', 'x', 'y' ], true ) ? $data['distribute'] : 'none',
			// Tipografía del menú de la cabecera. Vacío significa «lo que
			// diga el tema»: así una cabecera que nunca se tocó se ve
			// exactamente igual que antes.
			'navFont'      => sanitize_text_field( $data['navFont'] ?? '' ),
			'navWeight'    => preg_replace( '/[^0-9]/', '', (string) ( $data['navWeight'] ?? '' ) ),
			'navStyle'     => in_array( ( $data['navStyle'] ?? '' ), [ 'italic', 'oblique' ], true ) ? (string) $data['navStyle'] : 'normal',
			'navSize'      => max( 0, min( 48, absint( $data['navSize'] ?? 0 ) ) ),
			'navTransform' => in_array( ( $data['navTransform'] ?? '' ), [ 'uppercase', 'lowercase', 'capitalize' ], true ) ? (string) $data['navTransform'] : 'none',
			'navTracking'  => max( -10, min( 100, (int) ( $data['navTracking'] ?? 0 ) ) ),
			'navModeDesktop' => self::nav_mode( $data['navModeDesktop'] ?? 'bar', 'bar' ),
			'navModeTablet'  => self::nav_mode( $data['navModeTablet'] ?? 'bar', 'bar' ),
			'navModeMobile'  => self::nav_mode( $data['navModeMobile'] ?? 'drawer', 'drawer' ),
				'background'  => sanitize_text_field( $data['background'] ?? 'var(--color-background)' ),
				'color'       => sanitize_text_field( $data['color'] ?? 'var(--color-text)' ),
			]
		);
		update_option( MERIDIAN_OPTION_HEADER, $data, false );
		\Meridian\Cache\DocumentCache::flush_chrome();
		return self::with_logo_urls( $data );
	}

	public static function save_footer( array $data ): array {
		$social = [];
		$raw    = $data['social'] ?? [];
		if ( is_string( $raw ) ) {
			foreach ( preg_split( '/\r\n|\r|\n/', $raw ) as $line ) {
				$line = trim( $line );
				if ( ! $line ) {
					continue;
				}
				$parts    = array_map( 'trim', explode( '|', $line, 2 ) );
				$social[] = [
					'label' => sanitize_text_field( $parts[0] ?? '' ),
					'url'   => \Meridian\Security\UrlValidator::sanitize( $parts[1] ?? '#' ),
				];
			}
		} elseif ( is_array( $raw ) ) {
			foreach ( $raw as $row ) {
				if ( ! is_array( $row ) ) {
					continue;
				}
				$social[] = [
					'label' => sanitize_text_field( $row['label'] ?? '' ),
					'url'   => \Meridian\Security\UrlValidator::sanitize( $row['url'] ?? '' ),
				];
			}
		}
		$data = array_merge(
			self::default_footer(),
			[
				'logoId'        => absint( $data['logoId'] ?? 0 ),
				'logoText'      => sanitize_text_field( $data['logoText'] ?? '' ),
				'reveal'        => in_array( sanitize_key( (string) ( $data['reveal'] ?? 'stagger' ) ), [ 'none', 'rise', 'stagger', 'curtain' ], true )
					? sanitize_key( (string) ( $data['reveal'] ?? 'stagger' ) )
					: 'stagger',
				'text'          => sanitize_textarea_field( $data['text'] ?? '' ),
				'copyright'     => sanitize_text_field( $data['copyright'] ?? '' ),
				'copyrightUrl'    => \Meridian\Security\UrlValidator::sanitize( (string) ( $data['copyrightUrl'] ?? '' ) ),
				'copyrightNewTab' => ! empty( $data['copyrightNewTab'] ),
				'copyrightFont'   => sanitize_text_field( $data['copyrightFont'] ?? '' ),
				'copyrightWeight' => preg_replace( '/[^0-9]/', '', (string) ( $data['copyrightWeight'] ?? '' ) ),
				'copyrightStyle'  => in_array( ( $data['copyrightStyle'] ?? '' ), [ 'italic', 'oblique' ], true ) ? (string) $data['copyrightStyle'] : 'normal',
				'copyrightSize'   => max( 10, min( 48, absint( $data['copyrightSize'] ?? 13 ) ) ),
				'copyrightAlign'  => in_array( ( $data['copyrightAlign'] ?? '' ), [ 'left', 'center', 'right' ], true ) ? (string) $data['copyrightAlign'] : 'left',
				'copyrightBg'     => sanitize_text_field( $data['copyrightBg'] ?? '' ),
				'align'           => in_array( ( $data['align'] ?? '' ), [ 'left', 'center', 'right' ], true ) ? (string) $data['align'] : 'left',
				'vAlign'          => in_array( ( $data['vAlign'] ?? '' ), [ 'start', 'center', 'end' ], true ) ? (string) $data['vAlign'] : 'start',
				'distribute'      => in_array( ( $data['distribute'] ?? '' ), [ 'x', 'y', 'none' ], true ) ? (string) $data['distribute'] : 'none',
				'menuSlug'      => sanitize_key( $data['menuSlug'] ?? 'footer' ),
				'columns'       => max( 1, min( 4, absint( $data['columns'] ?? 3 ) ) ),
				'paddingY'      => max( 0, absint( $data['paddingY'] ?? 64 ) ),
				'background'    => sanitize_text_field( $data['background'] ?? 'var(--color-secondary)' ),
				'color'         => sanitize_text_field( $data['color'] ?? 'var(--color-on-secondary, #fff)' ),
			'extraTitle'    => sanitize_text_field( $data['extraTitle'] ?? '' ),
			'extraText'     => sanitize_textarea_field( $data['extraText'] ?? '' ),
			'showSearch'    => ! empty( $data['showSearch'] ),
			'social'        => $social,
			'linkColor'       => sanitize_text_field( $data['linkColor'] ?? '' ),
			'headingColor'    => sanitize_text_field( $data['headingColor'] ?? '' ),
			'copyrightColor'  => sanitize_text_field( $data['copyrightColor'] ?? '' ),
			'linkHoverFg'     => sanitize_text_field( $data['linkHoverFg'] ?? '' ),
			'linkHoverBg'     => sanitize_text_field( $data['linkHoverBg'] ?? '' ),
			'htmlId'          => sanitize_html_class( (string) ( $data['htmlId'] ?? '' ) ),
			'htmlClass'       => sanitize_text_field( $data['htmlClass'] ?? '' ),
			'showClassic'     => array_key_exists( 'showClassic', $data ) ? ! empty( $data['showClassic'] ) : true,
			'sections'        => self::sanitize_sections( $data['sections'] ?? [] ),
		]
	);
	update_option( MERIDIAN_OPTION_FOOTER, $data, false );
		\Meridian\Cache\DocumentCache::flush_chrome();
		return $data;
	}

	public static function logo_href( array $h ): string {
		$kind = $h['logoLink'] ?? 'home';
		$url  = trim( (string) ( $h['logoUrl'] ?? '' ) );
		if ( 'section' === $kind ) {
			$id = sanitize_html_class( ltrim( $url, '#' ) );
			return $id !== '' ? '#' . $id : home_url( '/' );
		}
		if ( 'url' === $kind && $url !== '' ) {
			$clean = \Meridian\Security\UrlValidator::sanitize( $url );
			return $clean !== '' ? $clean : home_url( '/' );
		}
		return home_url( '/' );
	}

	public static function nav_mode( $mode, string $fallback = 'bar' ): string {
		$mode = sanitize_key( (string) $mode );
		return in_array( $mode, [ 'bar', 'drawer' ], true ) ? $mode : $fallback;
	}

	public static function corner_radius_key( string $mode ): string {
		$mode = sanitize_key( $mode );
		return in_array( $mode, [ 'none', 'sm', 'md', 'lg', 'full' ], true ) ? $mode : 'none';
	}

	public static function corner_radius_css( string $mode ): string {
		$map = [
			'none' => '0',
			'sm'   => 'var(--radius-sm, 4px)',
			'md'   => 'var(--radius-md, 8px)',
			'lg'   => 'var(--radius-lg, 16px)',
			'full' => '999px',
		];
		$key = self::corner_radius_key( $mode );
		return $map[ $key ];
	}

	public static function blend_mode( string $mode ): string {
		$ok = [
			'normal',
			'multiply',
			'screen',
			'overlay',
			'darken',
			'lighten',
			'color-dodge',
			'color-burn',
			'hard-light',
			'soft-light',
			'difference',
			'exclusion',
			'hue',
			'saturation',
			'color',
			'luminosity',
			'plus-lighter',
		];
		$mode = sanitize_key( str_replace( '_', '-', $mode ) );
		return in_array( $mode, $ok, true ) ? $mode : 'normal';
	}

	public static function default_header(): array {
		return [
			'logoId'      => 0,
			'logoMobile'  => 0,
			'logoWidth'         => 140,
			'logoWidthTablet'   => 140,
			'logoWidthMobile'   => 120,
			'sticky'      => true,
			/*
			 * El rótulo de la marca cuando todavía no hay logo.
			 *
			 * Antes se imprimía aquí el título del WordPress, que casi nunca
			 * es la marca: es el nombre que puso el instalador —el de la
			 * carpeta, el del hosting o el de la plantilla de pruebas— y
			 * acababa publicado en la cabecera de un sitio de verdad sin que
			 * nadie lo hubiera escrito. Ahora es un campo propio de la
			 * cabecera, editable desde el panel, y de fábrica dice lo que hay
			 * que hacer. Dejarlo vacío deja la marca en blanco a propósito.
			 */
			'logoText'    => __( 'Tu logo aquí', 'meridian' ),
			'ctaText'     => __( 'Contacto', 'meridian' ),
			'ctaUrl'      => '/contacto/',
			'menuSlug'    => 'header',
			'height'      => 72,
			'paddingY'    => 12,
			'transparent'  => false,
			'transOpacity' => 0,
			'transBlend'   => 'normal',
			'transBlur'    => 20,
			'transColor'   => '#ffffff',
			'logoLink'     => 'home',
			'logoUrl'      => '',
			'logoRadius'   => 'none',
			'navHoverFg'   => '',
			'navHoverBg'   => '',
			'align'       => 'left',
			'vAlign'      => 'center',
			'htmlId'      => '',
			'htmlClass'   => '',
			'animation'   => 'none',
			'animDuration'=> 600,
			'animDelay'   => 0,
			'distribute'  => 'none',
			'navFont'      => '',
			'navWeight'    => '',
			'navStyle'     => 'normal',
			'navSize'      => 0,
			'navTransform' => 'none',
			'navTracking'  => 0,
			'navModeDesktop' => 'bar',
			'navModeTablet'  => 'bar',
			'navModeMobile'  => 'drawer',
			'adaptive'       => 'off',
			'background'  => 'var(--color-background)',
			'color'       => 'var(--color-text)',
		];
	}

	public static function default_footer(): array {
		return [
			'logoId'     => 0,
			'logoText'   => __( 'Tu logo aquí', 'meridian' ),
			/*
			 * Lo de fábrica son marcadores, no contenido.
			 *
			 * Aquí había una frase que describía este CMS y un copyright a
			 * nombre de este CMS, y los dos se imprimían en el pie de la web
			 * del cliente: el visitante leía el nombre de la herramienta con
			 * la que está hecho el sitio en vez del nombre del negocio. Un
			 * marcador dice lo que hay que escribir ahí y no se publica a
			 * nombre de nadie.
			 */
			'text'       => __( 'Una línea sobre tu negocio.', 'meridian' ),
			'copyright'  => '© ' . gmdate( 'Y' ) . ' ' . __( 'Tu marca', 'meridian' ),
			'copyrightUrl'    => '',
			'copyrightNewTab' => false,
			'copyrightFont'   => '',
			'copyrightWeight' => '',
			'copyrightStyle'  => 'normal',
			'copyrightSize'   => 13,
			'copyrightAlign'  => 'left',
			'copyrightBg'     => '',
			'align'           => 'left',
			'vAlign'          => 'start',
			'distribute'      => 'none',
			'menuSlug'   => 'footer',
			'columns'    => 3,
			'paddingY'   => 64,
			'background' => 'var(--color-secondary)',
			'color'      => 'var(--color-on-secondary, #fff)',
			'extraTitle' => '',
			'extraText'  => '',
			'showSearch' => true,
			'social'     => [
				[ 'label' => 'Instagram', 'url' => 'https://instagram.com' ],
			],
			'linkColor'      => '',
			'headingColor'   => '',
			'copyrightColor' => '',
			'linkHoverFg'    => '',
			'linkHoverBg'    => '',
			'htmlId'         => '',
			'htmlClass'      => '',
			'showClassic'    => true,
			'reveal'         => 'stagger',
			'sections'       => [],
		];
	}

	public static function sanitize_sections( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return [];
		}
		$out = [];
		foreach ( array_slice( $raw, 0, 40 ) as $node ) {
			if ( is_array( $node ) ) {
				$out[] = \Meridian\Security\Sanitizer::node( $node, 0 );
			}
		}
		return $out;
	}

	public static function render_footer_sections( array $f ): string {
		$sections = $f['sections'] ?? [];
		if ( ! $sections ) {
			return '';
		}
		$ctx            = new \Meridian\Render\RenderContext();
		$ctx->isPreview = \Meridian\Render\Preview::is_preview();
		// Igual que en el cuerpo de la página: una sección de pie sin
		// contenido no se imprime, salvo en el lienzo, donde hay que poder
		// seleccionarla para llenarla.
		$ctx->isCanvas  = \Meridian\Render\Preview::is_canvas();
		$html           = '<div class="m-footer-sections">';
		foreach ( $sections as $section ) {
			if ( is_array( $section ) ) {
				$html .= \Meridian\Render\NodeRenderer::render( $section, $ctx );
			}
		}
		$html .= '</div>';
		return $html;
	}

	public static function social_lines( array $footer ): string {
		$out = [];
		foreach ( $footer['social'] ?? [] as $row ) {
			$out[] = ( $row['label'] ?? '' ) . '|' . ( $row['url'] ?? '' );
		}
		return implode( "\n", $out );
	}

	public static function identity(): array {
		$i = get_option( MERIDIAN_OPTION_IDENTITY, [] );
		if ( ! is_array( $i ) ) {
			$i = [];
		}
		return wp_parse_args(
			$i,
			[
				'siteName' => get_bloginfo( 'name' ),
				'tagline'  => get_bloginfo( 'description' ),
				'logoId'   => 0,
				'faviconId'=> 0,
			]
		);
	}

	public static function save_identity( array $data ): array {
		$out = [
			'siteName'  => sanitize_text_field( $data['siteName'] ?? '' ),
			'tagline'   => sanitize_text_field( $data['tagline'] ?? '' ),
			'logoId'    => absint( $data['logoId'] ?? 0 ),
			'faviconId' => absint( $data['faviconId'] ?? 0 ),
		];
		if ( $out['siteName'] ) {
			update_option( 'blogname', $out['siteName'] );
		}
		if ( $out['tagline'] !== '' ) {
			update_option( 'blogdescription', $out['tagline'] );
		}
		if ( $out['faviconId'] ) {
			update_option( 'site_icon', $out['faviconId'] );
		}
		update_option( MERIDIAN_OPTION_IDENTITY, $out, false );
		return $out;
	}
}

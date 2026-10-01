<?php
/**
 * Font families: system, web catalog, WordPress Font Library.
 *
 * @package Meridian
 */

namespace Meridian\Design;

defined( 'ABSPATH' ) || exit;

class FontCatalog {

	public static function list(): array {
		$out  = [];
		$seen = [];
		foreach ( array_merge( self::wordpress(), self::web(), self::system() ) as $item ) {
			$key = strtolower( preg_replace( '/\s+/', '', $item['css'] ) );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$out[]        = $item;
		}
		return $out;
	}

	public static function enqueue_used( string $handle = 'krg-base' ): void {
		$used = [];
		$data = TokenRepository::get();
		foreach ( $data['tokens']['font'] ?? [] as $item ) {
			$val = is_array( $item ) ? (string) ( $item['value'] ?? '' ) : (string) $item;
			if ( $val ) {
				$used[] = $val;
			}
		}
		if ( class_exists( '\\Meridian\\Render\\PageRenderer' ) ) {
			$doc = \Meridian\Render\PageRenderer::current_document();
			if ( is_array( $doc ) ) {
				self::collect_families( $doc['sections'] ?? [], $used );
			}
		}
		$google = [];
		$faces  = [];
		foreach ( self::list() as $f ) {
			$hit = false;
			foreach ( $used as $val ) {
				if ( $val === $f['css'] || str_contains( $val, $f['name'] ) ) {
					$hit = true;
					break;
				}
			}
			if ( ! $hit ) {
				continue;
			}
			if ( ! empty( $f['google'] ) ) {
				$google[] = $f['google'];
			}
			if ( ! empty( $f['faces'] ) && is_array( $f['faces'] ) ) {
				$faces = array_merge( $faces, $f['faces'] );
			}
		}
		$google = array_unique( $google );
			if ( $google ) {
			$axis = 'ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700';
			$parts = [];
			foreach ( $google as $family ) {
				$parts[] = 'family=' . rawurlencode( $family ) . ':' . $axis;
			}
			wp_enqueue_style( 'krg-fonts', 'https://fonts.googleapis.com/css2?' . implode( '&', $parts ) . '&display=swap', [], null );
		}
		if ( $faces ) {
			$css = '';
			foreach ( $faces as $face ) {
				$src = esc_url( $face['src'] ?? '' );
				if ( ! $src ) {
					continue;
				}
				$fam = $face['family'] ?? '';
				$css .= '@font-face{font-family:' . $fam . ';src:url(' . $src . ') format("woff2");font-weight:' . ( $face['weight'] ?? '400' ) . ';font-style:' . ( $face['style'] ?? 'normal' ) . ';font-display:swap;}';
			}
			if ( $css ) {
				if ( ! wp_style_is( $handle, 'registered' ) && ! wp_style_is( $handle, 'enqueued' ) ) {
					$handle = 'krg-font-faces';
					wp_register_style( $handle, false, [], MERIDIAN_VERSION );
					wp_enqueue_style( $handle );
				}
				wp_add_inline_style( $handle, $css );
			}
		}
	}

	private static function system(): array {
		$rows = [
			[ 'Sistema (sans)', 'system-ui, -apple-system, "Segoe UI", sans-serif' ],
			[ 'Arial', 'Arial, Helvetica, sans-serif' ],
			[ 'Helvetica', 'Helvetica, Arial, sans-serif' ],
			[ 'Verdana', 'Verdana, Geneva, sans-serif' ],
			[ 'Tahoma', 'Tahoma, Verdana, sans-serif' ],
			[ 'Trebuchet MS', '"Trebuchet MS", Helvetica, sans-serif' ],
			[ 'Georgia', 'Georgia, "Times New Roman", serif' ],
			[ 'Times New Roman', '"Times New Roman", Times, serif' ],
			[ 'Palatino', 'Palatino, "Palatino Linotype", "Iowan Old Style", Georgia, serif' ],
			[ 'Garamond', 'Garamond, "Times New Roman", serif' ],
			[ 'Courier New', '"Courier New", Courier, monospace' ],
			[ 'Monospace', 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' ],
		];
		$out = [];
		foreach ( $rows as $i => $row ) {
			$out[] = [
				'id'       => 'sys-' . $i,
				'group'    => 'system',
				'name'     => $row[0],
				'css'      => $row[1],
				'google'   => '',
				'faces'    => [],
				'variants' => self::default_variants(),
			];
		}
		return $out;
	}

	private static function web(): array {
		$rows = [
			[ 'Inter', 'Inter', 'sans-serif' ],
			[ 'Roboto', 'Roboto', 'sans-serif' ],
			[ 'Open Sans', 'Open Sans', 'sans-serif' ],
			[ 'Lato', 'Lato', 'sans-serif' ],
			[ 'Montserrat', 'Montserrat', 'sans-serif' ],
			[ 'Poppins', 'Poppins', 'sans-serif' ],
			[ 'Nunito', 'Nunito', 'sans-serif' ],
			[ 'Source Sans 3', 'Source Sans 3', 'sans-serif' ],
			[ 'Work Sans', 'Work Sans', 'sans-serif' ],
			[ 'Raleway', 'Raleway', 'sans-serif' ],
			[ 'Outfit', 'Outfit', 'sans-serif' ],
			[ 'Manrope', 'Manrope', 'sans-serif' ],
			[ 'DM Sans', 'DM Sans', 'sans-serif' ],
			[ 'Plus Jakarta Sans', 'Plus Jakarta Sans', 'sans-serif' ],
			[ 'Playfair Display', 'Playfair Display', 'serif' ],
			[ 'Merriweather', 'Merriweather', 'serif' ],
			[ 'Lora', 'Lora', 'serif' ],
			[ 'Cormorant Garamond', 'Cormorant Garamond', 'serif' ],
			[ 'EB Garamond', 'EB Garamond', 'serif' ],
			[ 'Libre Baskerville', 'Libre Baskerville', 'serif' ],
			[ 'Source Serif 4', 'Source Serif 4', 'serif' ],
			[ 'Oswald', 'Oswald', 'sans-serif' ],
			[ 'Bebas Neue', 'Bebas Neue', 'sans-serif' ],
			[ 'Space Grotesk', 'Space Grotesk', 'sans-serif' ],
			[ 'IBM Plex Sans', 'IBM Plex Sans', 'sans-serif' ],
			[ 'IBM Plex Serif', 'IBM Plex Serif', 'serif' ],
		];
		$out = [];
		foreach ( $rows as $row ) {
			$out[] = [
				'id'       => 'web-' . sanitize_title( $row[1] ),
				'group'    => 'web',
				'name'     => $row[0],
				'css'      => '"' . $row[1] . '", ' . $row[2],
				'google'   => $row[1],
				'faces'    => [],
				'variants' => self::default_variants(),
			];
		}
		return $out;
	}

	private static function wordpress(): array {
		$out = [];
		if ( function_exists( 'wp_get_global_settings' ) ) {
			$raw = wp_get_global_settings( [ 'typography', 'fontFamilies' ] );
			self::collect_global( $raw, $out );
		}
		if ( post_type_exists( 'wp_font_family' ) ) {
			$posts = get_posts(
				[
					'post_type'      => 'wp_font_family',
					'post_status'    => [ 'publish', 'draft' ],
					'posts_per_page' => 80,
					'orderby'        => 'title',
					'order'          => 'ASC',
				]
			);
			foreach ( $posts as $p ) {
				$data   = json_decode( (string) $p->post_content, true );
				$family = is_array( $data ) ? (string) ( $data['fontFamily'] ?? $p->post_title ) : $p->post_title;
				$css    = $family;
				if ( $css && ! str_contains( $css, ',' ) && ! str_starts_with( $css, '"' ) ) {
					$css = '"' . $family . '", sans-serif';
				}
				$faces  = [];
				$kids   = get_children(
					[
						'post_parent' => $p->ID,
						'post_type'   => 'wp_font_face',
						'numberposts' => 20,
					]
				);
				foreach ( $kids as $kid ) {
					$face = json_decode( (string) $kid->post_content, true );
					if ( ! is_array( $face ) ) {
						continue;
					}
					$src = '';
					if ( ! empty( $face['src'] ) && is_array( $face['src'] ) ) {
						$src = (string) $face['src'][0];
					} elseif ( ! empty( $face['src'] ) ) {
						$src = (string) $face['src'];
					}
					if ( $src ) {
						$faces[] = [
							'family' => '"' . $family . '"',
							'src'    => $src,
							'weight' => (string) ( $face['fontWeight'] ?? '400' ),
							'style'  => (string) ( $face['fontStyle'] ?? 'normal' ),
						];
					}
				}
				$out[] = [
					'id'       => 'wp-' . $p->ID,
					'group'    => 'wordpress',
					'name'     => $p->post_title ?: $family,
					'css'      => $css,
					'google'   => '',
					'faces'    => $faces,
					'variants' => self::variants_from_faces( $faces ),
				];
			}
		}
		return $out;
	}

	private static function collect_global( $raw, array &$out ): void {
		if ( ! is_array( $raw ) ) {
			return;
		}
		if ( isset( $raw['fontFamily'] ) ) {
			$raw = [ $raw ];
		}
		foreach ( $raw as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			if ( isset( $item['fontFamily'] ) ) {
				$css  = (string) $item['fontFamily'];
				$name = (string) ( $item['name'] ?? $css );
				if ( ! $css ) {
					continue;
				}
				$out[] = [
					'id'       => 'wp-g-' . sanitize_title( (string) ( $item['slug'] ?? $name ) ),
					'group'    => 'wordpress',
					'name'     => $name,
					'css'      => $css,
					'google'   => '',
					'faces'    => [],
					'variants' => self::default_variants(),
				];
				continue;
			}
			self::collect_global( $item, $out );
		}
	}

	private static function default_variants(): array {
		$names = [
			'300' => 'Light',
			'400' => 'Regular',
			'500' => 'Medium',
			'600' => 'Semibold',
			'700' => 'Bold',
		];
		$out = [];
		foreach ( $names as $w => $lab ) {
			$out[] = [
				'id'     => $w . '-normal',
				'label'  => $lab,
				'weight' => $w,
				'style'  => 'normal',
			];
			$out[] = [
				'id'     => $w . '-italic',
				'label'  => ( '400' === $w ) ? 'Italic' : ( $lab . ' Italic' ),
				'weight' => $w,
				'style'  => 'italic',
			];
		}
		return $out;
	}

	private static function variant_label( string $weight, string $style ): string {
		$names = [
			'100' => 'Thin',
			'200' => 'Extra Light',
			'300' => 'Light',
			'400' => 'Regular',
			'500' => 'Medium',
			'600' => 'Semibold',
			'700' => 'Bold',
			'800' => 'Extra Bold',
			'900' => 'Black',
		];
		$lab = $names[ $weight ] ?? $weight;
		$italic = in_array( $style, [ 'italic', 'oblique' ], true );
		if ( $italic && '400' === $weight ) {
			return 'Italic';
		}
		return $italic ? ( $lab . ' Italic' ) : $lab;
	}

	private static function variants_from_faces( array $faces ): array {
		$out  = [];
		$seen = [];
		foreach ( $faces as $face ) {
			$w = trim( (string) ( $face['weight'] ?? '400' ) );
			$s = trim( (string) ( $face['style'] ?? 'normal' ) );
			if ( $w === '' ) {
				$w = '400';
			}
			if ( str_contains( $w, ' ' ) ) {
				return self::default_variants();
			}
			$id = $w . '-' . $s;
			if ( isset( $seen[ $id ] ) ) {
				continue;
			}
			$seen[ $id ] = true;
			$out[]       = [
				'id'     => $id,
				'label'  => self::variant_label( $w, $s ),
				'weight' => $w,
				'style'  => $s,
			];
		}
		return $out ?: self::default_variants();
	}

	private static function collect_families( array $nodes, array &$used ): void {
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			foreach ( $node['styles'] ?? [] as $bp ) {
				if ( is_array( $bp ) && ! empty( $bp['font-family'] ) ) {
					$used[] = (string) $bp['font-family'];
				}
			}
			if ( ! empty( $node['children'] ) && is_array( $node['children'] ) ) {
				self::collect_families( $node['children'], $used );
			}
		}
	}
}

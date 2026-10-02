<?php
/**
 * Schema-aware sanitizer.
 *
 * @package Meridian
 */

namespace Meridian\Security;

defined( 'ABSPATH' ) || exit;

class Sanitizer {

	public static function document( array $doc ): array {
		$out = [
			'version'         => 1,
			'id'              => absint( $doc['id'] ?? 0 ),
			'type'            => sanitize_key( $doc['type'] ?? 'page' ),
			'title'           => sanitize_text_field( $doc['title'] ?? '' ),
			'slug'            => sanitize_title( $doc['slug'] ?? '' ),
			'status'          => sanitize_key( $doc['status'] ?? 'draft' ),
			'parentId'        => absint( $doc['parentId'] ?? 0 ),
			'featuredImageId' => absint( $doc['featuredImageId'] ?? 0 ),
			'seo'             => self::seo( $doc['seo'] ?? [] ),
			'settings'        => [
				'showHeader' => ! empty( $doc['settings']['showHeader'] ),
				'showFooter' => ! empty( $doc['settings']['showFooter'] ),
				'layout'     => sanitize_key( $doc['settings']['layout'] ?? 'default' ),
				'headerMenu' => sanitize_key( (string) ( $doc['settings']['headerMenu'] ?? '' ) ),
			],
			'sections'        => [],
		];
		$sections = $doc['sections'] ?? [];
		if ( count( $sections ) > 80 ) {
			$sections = array_slice( $sections, 0, 80 );
		}
		foreach ( $sections as $section ) {
			if ( is_array( $section ) ) {
				$out['sections'][] = self::node( $section, 0 );
			}
		}
		return $out;
	}

	public static function node( array $node, int $depth ): array {
		if ( $depth > 8 ) {
			return [
				'id'       => self::id( $node['id'] ?? '' ),
				'type'     => 'paragraph',
				'visible'  => true,
				'source'   => 'local',
				'props'    => [ 'text' => '' ],
				'styles'   => self::styles( [] ),
				'children' => [],
			];
		}
		$type = sanitize_key( $node['type'] ?? 'paragraph' );
		$def  = \Meridian\Components\Registry::get( $type );
		$out  = [
			'id'       => self::id( $node['id'] ?? '' ),
			'type'     => $type,
			'name'     => sanitize_text_field( $node['name'] ?? '' ),
			'visible'  => array_key_exists( 'visible', $node ) ? (bool) $node['visible'] : true,
			'locked'   => ! empty( $node['locked'] ),
			'source'    => ( ( $node['source'] ?? 'local' ) === 'global' ) ? 'global' : 'local',
			'globalId'  => absint( $node['globalId'] ?? 0 ),
			'htmlId'    => sanitize_html_class( (string) ( $node['htmlId'] ?? '' ) ),
			'htmlClass' => implode(
				' ',
				array_filter(
					array_map(
						'sanitize_html_class',
						preg_split( '/\s+/', (string) ( $node['htmlClass'] ?? '' ) ) ?: []
					)
				)
			),
			'hiddenOn'  => [
				'desktop' => ! empty( $node['hiddenOn']['desktop'] ),
				'tablet'  => ! empty( $node['hiddenOn']['tablet'] ),
				'mobile'  => ! empty( $node['hiddenOn']['mobile'] ),
			],
			'animation'    => in_array( sanitize_key( (string) ( $node['animation'] ?? 'none' ) ), [ 'none', 'fade', 'slide', 'zoom', 'bounce', 'flip', 'rise', 'stagger' ], true ) ? sanitize_key( (string) ( $node['animation'] ?? 'none' ) ) : 'none',
			'animDuration' => max( 0, min( 3000, absint( $node['animDuration'] ?? 600 ) ) ),
			'animDelay'    => max( 0, min( 3000, absint( $node['animDelay'] ?? 0 ) ) ),
			'animEasing'   => in_array( (string) ( $node['animEasing'] ?? 'ease' ), [ 'ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out' ], true ) ? (string) $node['animEasing'] : 'ease',
			'filters'      => self::filters( $node['filters'] ?? [] ),
			'customCss'    => self::custom_css_fields( $node['customCss'] ?? [] ),
			'props'        => [],
			'styles'       => self::styles( $node['styles'] ?? [] ),
			'children'     => [],
		];
		$props = is_array( $node['props'] ?? null ) ? $node['props'] : [];
		if ( $def ) {
			$out['props'] = self::props( $props, $def );
		} else {
			$out['props'] = array_merge( self::generic_props( $props ), self::align_props( $props ) );
		}
		$children = $node['children'] ?? [];
		if ( is_array( $children ) ) {
			if ( count( $children ) > 50 ) {
				$children = array_slice( $children, 0, 50 );
			}
			foreach ( $children as $child ) {
				if ( is_array( $child ) ) {
					$out['children'][] = self::node( $child, $depth + 1 );
				}
			}
		}
		return $out;
	}

	public static function props( array $props, array $def ): array {
		$out    = [];
		$fields = $def['fields'] ?? [];
		foreach ( $fields as $field ) {
			$key = $field['key'] ?? '';
			if ( ! $key ) {
				continue;
			}
			$out[ $key ] = self::field( $props[ $key ] ?? ( $def['defaults'][ $key ] ?? null ), $field );
		}
		if ( 'everest-form' === ( $def['slug'] ?? '' ) ) {
			$out['formId'] = absint( $props['formId'] ?? $out['formId'] ?? 0 );
		}
		return array_merge( $out, self::align_props( $props ) );
	}

	private static function align_props( array $props ): array {
		$axis = [ 'start', 'center', 'end', 'stretch' ];
		$h    = sanitize_key( (string) ( $props['alignH'] ?? 'start' ) );
		$v    = sanitize_key( (string) ( $props['alignV'] ?? 'start' ) );
		$d    = sanitize_key( (string) ( $props['distribute'] ?? 'none' ) );
		return [
			'alignH'     => in_array( $h, $axis, true ) ? $h : 'start',
			'alignV'     => in_array( $v, $axis, true ) ? $v : 'start',
			'distribute' => in_array( $d, [ 'none', 'x', 'y' ], true ) ? $d : 'none',
		];
	}

	public static function field( $value, array $field ) {
		$type = $field['type'] ?? 'text';
		switch ( $type ) {
			case 'toggle':
				return (bool) $value;
			case 'number':
				$n = is_numeric( $value ) ? 0 + $value : 0;
				if ( isset( $field['min'] ) ) {
					$n = max( $field['min'], $n );
				}
				if ( isset( $field['max'] ) ) {
					$n = min( $field['max'], $n );
				}
				return $n;
			case 'select':
			case 'htmlTag':
			case 'alignment':
				$opts = $field['options'] ?? [];
				$flat = [];
				foreach ( $opts as $opt ) {
					$flat[] = is_array( $opt ) ? (string) ( $opt['value'] ?? '' ) : (string) $opt;
				}
				$v = is_string( $value ) ? $value : (string) $value;
				if ( ! $flat ) {
					return is_numeric( $value ) ? 0 + $value : sanitize_text_field( $v );
				}
				if ( in_array( $v, $flat, true ) ) {
					return is_numeric( $v ) ? 0 + $v : $v;
				}
				foreach ( $flat as $opt ) {
					if ( is_numeric( $opt ) && is_numeric( $v ) && (int) $opt === (int) $v ) {
						return 0 + $opt;
					}
				}
				return $flat[0] ?? '';
			case 'mapsUrl':
				return UrlValidator::maps( (string) $value );
			case 'url':
			case 'link':
				if ( is_array( $value ) ) {
					return [
						'url'    => UrlValidator::sanitize( (string) ( $value['url'] ?? '' ) ),
						'target' => in_array( $value['target'] ?? '_self', [ '_self', '_blank' ], true ) ? $value['target'] : '_self',
						'rel'    => sanitize_text_field( $value['rel'] ?? '' ),
					];
				}
				return UrlValidator::sanitize( (string) $value );
			case 'email':
				return sanitize_email( (string) $value );
			case 'image':
				return absint( $value );
			case 'textarea':
				return sanitize_textarea_field( (string) $value );
			case 'richtext':
				return self::richtext( (string) $value );
			case 'color':
				return self::color( $value );
			case 'spacing':
				return self::spacing( $value );
			case 'repeater':
				$items = is_array( $value ) ? $value : [];
				// Tope por defecto 50. Un bloque puede pedir mas (una carta
				// de restaurante no cabe en 50 platos), nunca mas de 300.
				$limit = absint( $field['maxItems'] ?? 50 );
				$limit = max( 1, min( 300, $limit ?: 50 ) );
				$items = array_slice( $items, 0, $limit );
				$sub   = $field['itemFields'] ?? [];
				$out   = [];
				foreach ( $items as $item ) {
					if ( ! is_array( $item ) ) {
						continue;
					}
					$row = [];
					foreach ( $sub as $sf ) {
						$k         = $sf['key'] ?? '';
						$row[ $k ] = self::field( $item[ $k ] ?? null, $sf );
					}
					$out[] = $row;
				}
				return $out;
			case 'map':
				return [
					'url'    => UrlValidator::maps( (string) ( is_array( $value ) ? ( $value['url'] ?? '' ) : $value ) ),
					'lat'    => isset( $value['lat'] ) ? (float) $value['lat'] : null,
					'lng'    => isset( $value['lng'] ) ? (float) $value['lng'] : null,
					'zoom'   => min( 21, max( 1, absint( is_array( $value ) ? ( $value['zoom'] ?? 14 ) : 14 ) ) ),
					'height' => absint( is_array( $value ) ? ( $value['height'] ?? 360 ) : 360 ),
				];
			default:
				if ( is_array( $value ) ) {
					return self::generic_props( $value );
				}
				return sanitize_text_field( (string) $value );
		}
	}

	public static function color( $value ): array {
		if ( is_string( $value ) ) {
			if ( str_starts_with( $value, 'token:' ) ) {
				return [ 'mode' => 'token', 'token' => sanitize_text_field( substr( $value, 6 ) ) ];
			}
			return [ 'mode' => 'custom', 'value' => sanitize_hex_color( $value ) ?: '#000000' ];
		}
		if ( ! is_array( $value ) ) {
			return [ 'mode' => 'token', 'token' => 'color.primary' ];
		}
		$mode = ( $value['mode'] ?? 'token' ) === 'custom' ? 'custom' : 'token';
		return [
			'mode'  => $mode,
			'token' => sanitize_text_field( $value['token'] ?? 'color.primary' ),
			'value' => sanitize_hex_color( $value['value'] ?? '' ) ?: '',
		];
	}

	public static function spacing( $value ): array {
		$sides = [ 'top', 'right', 'bottom', 'left' ];
		$out   = [];
		if ( is_string( $value ) ) {
			foreach ( $sides as $s ) {
				$out[ $s ] = self::css_length( $value );
			}
			return $out;
		}
		if ( ! is_array( $value ) ) {
			return [ 'top' => '', 'right' => '', 'bottom' => '', 'left' => '' ];
		}
		foreach ( $sides as $s ) {
			$out[ $s ] = self::css_length( (string) ( $value[ $s ] ?? '' ) );
		}
		return $out;
	}

	public static function css_length( string $v ): string {
		$v = trim( $v );
		if ( $v === '' ) {
			return '';
		}
		if ( str_starts_with( $v, 'var(' ) ) {
			return \Meridian\Design\TokenCompiler::safe_css( $v );
		}
		if ( preg_match( '/^-?[0-9]+(\.[0-9]+)?(px|rem|em|%|vh|vw)?$/', $v ) ) {
			return $v;
		}
		return '';
	}

	public static function styles( $styles ): array {
		$bp  = [ 'desktop' => [], 'tablet' => [], 'mobile' => [] ];
		if ( ! is_array( $styles ) ) {
			return $bp;
		}
		foreach ( $bp as $k => $_ ) {
			$bp[ $k ] = is_array( $styles[ $k ] ?? null ) ? self::style_props( $styles[ $k ] ) : [];
		}
		return $bp;
	}

	public static function style_props( array $styles ): array {
		$allowed = [
			'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
			'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
			'font-size', 'font-weight', 'font-family', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'text-decoration',
			'color', 'background', 'background-color', 'text-align',
			'border-radius', 'box-shadow', 'border', 'border-color', 'border-width', 'border-style',
			'gap', 'display', 'grid-template-columns', 'order', 'max-width', 'max-height', 'min-width', 'min-height', 'width', 'height',
			'opacity', 'align-items', 'justify-content', 'flex-direction', 'object-fit', 'object-position',
			'filter', 'box-shadow', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
			'transition', 'transition-duration', 'transition-delay', 'transition-timing-function',
			'animation-duration', 'animation-delay', 'animation-timing-function',
		];
		$out = [];
		foreach ( $styles as $prop => $val ) {
			$prop = sanitize_title( $prop );
			$prop = str_replace( '_', '-', $prop );
			if ( ! in_array( $prop, $allowed, true ) ) {
				continue;
			}
			if ( is_array( $val ) ) {
				if ( isset( $val['top'] ) ) {
					$parts = [];
					foreach ( [ 'top', 'right', 'bottom', 'left' ] as $s ) {
						$parts[] = self::css_length( (string) ( $val[ $s ] ?? '0' ) ) ?: '0';
					}
					$out[ $prop ] = implode( ' ', $parts );
				} elseif ( ( $val['mode'] ?? '' ) === 'token' ) {
					$out[ $prop ] = \Meridian\Design\TokenCompiler::token_var( (string) ( $val['token'] ?? 'color.primary' ) );
				} elseif ( ! empty( $val['value'] ) ) {
					$out[ $prop ] = \Meridian\Design\TokenCompiler::safe_css( (string) $val['value'] );
				}
			} else {
				$out[ $prop ] = \Meridian\Design\TokenCompiler::safe_css( (string) $val );
			}
		}
		return $out;
	}

	public static function seo( $seo ): array {
		$seo = is_array( $seo ) ? $seo : [];
		$allowed_robots = [ 'index,follow', 'noindex,follow', 'index,nofollow', 'noindex,nofollow' ];
		$robots         = sanitize_text_field( $seo['robots'] ?? 'index,follow' );
		if ( ! in_array( $robots, $allowed_robots, true ) ) {
			$robots = 'index,follow';
		}
		return [
			'title'         => sanitize_text_field( $seo['title'] ?? '' ),
			'description'   => sanitize_textarea_field( $seo['description'] ?? '' ),
			'canonical'     => UrlValidator::sanitize( $seo['canonical'] ?? '' ),
			'ogTitle'       => sanitize_text_field( $seo['ogTitle'] ?? '' ),
			'ogDescription' => sanitize_textarea_field( $seo['ogDescription'] ?? '' ),
			'ogImageId'     => absint( $seo['ogImageId'] ?? 0 ),
			'robots'        => $robots,
		];
	}

	public static function richtext( string $html ): string {
		$allowed = [
			'p'          => [],
			'br'         => [],
			'strong'     => [],
			'b'          => [],
			'em'         => [],
			'i'          => [],
			'ul'         => [],
			'ol'         => [],
			'li'         => [],
			'blockquote' => [],
			'h2'         => [],
			'h3'         => [],
			'h4'         => [],
			'a'          => [
				'href'   => true,
				'rel'    => true,
				'target' => true,
			],
		];
		$html = wp_kses( $html, $allowed );
		$html = preg_replace_callback(
			'#href=(["\'])(.*?)\1#i',
			static function ( $m ) {
				$url = UrlValidator::sanitize( html_entity_decode( $m[2] ) );
				if ( $url === '' || UrlValidator::is_dangerous( $m[2] ) ) {
					return 'href=' . $m[1] . '#' . $m[1];
				}
				return 'href=' . $m[1] . esc_attr( $url ) . $m[1];
			},
			$html
		);
		return $html ?: '';
	}

	public static function id( string $id ): string {
		$id = preg_replace( '/[^a-zA-Z0-9_\-]/', '', $id );
		if ( $id === '' ) {
			$id = 'n_' . wp_generate_uuid4();
		}
		return $id;
	}

	public static function filters( $v ): array {
		$v = is_array( $v ) ? $v : [];
		$n = static function ( $x, $min, $max, $def ) {
			if ( ! is_numeric( $x ) ) {
				return $def;
			}
			return max( $min, min( $max, 0 + $x ) );
		};
		return [
			'hue'        => $n( $v['hue'] ?? 0, 0, 360, 0 ),
			'sat'        => $n( $v['sat'] ?? 100, 0, 200, 100 ),
			'brightness' => $n( $v['brightness'] ?? 100, 0, 200, 100 ),
			'contrast'   => $n( $v['contrast'] ?? 100, 0, 200, 100 ),
			'invert'     => $n( $v['invert'] ?? 0, 0, 100, 0 ),
			'sepia'      => $n( $v['sepia'] ?? 0, 0, 100, 0 ),
		];
	}

	public static function custom_css_fields( $v ): array {
		$v = is_array( $v ) ? $v : [];
		$clean = static function ( $css ) {
			$css = (string) $css;
			$css = str_ireplace( [ '</', 'javascript', 'expression', '@import', 'behavior', 'url(' ], '', $css );
			$css = preg_replace( '/[<>]/', '', $css );
			return trim( (string) $css );
		};
		return [
			'before' => $clean( $v['before'] ?? '' ),
			'main'   => $clean( $v['main'] ?? '' ),
			'after'  => $clean( $v['after'] ?? '' ),
		];
	}

	private static function generic_props( array $props ): array {
		$out = [];
		foreach ( $props as $k => $v ) {
			$key = sanitize_key( (string) $k );
			if ( is_bool( $v ) ) {
				$out[ $key ] = $v;
			} elseif ( is_numeric( $v ) ) {
				$out[ $key ] = 0 + $v;
			} elseif ( is_array( $v ) ) {
				$out[ $key ] = self::generic_props( $v );
			} else {
				$out[ $key ] = sanitize_text_field( (string) $v );
			}
		}
		return $out;
	}
}

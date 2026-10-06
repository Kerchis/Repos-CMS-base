<?php
/**
 * Recursive node renderer.
 *
 * @package Meridian
 */

namespace Meridian\Render;

defined( 'ABSPATH' ) || exit;

class NodeRenderer {

	public static function render( array $node, RenderContext $ctx ): string {
		if ( ( $node['source'] ?? 'local' ) === 'global' && ! empty( $node['globalId'] ) ) {
			$global = $ctx->globals[ (int) $node['globalId'] ] ?? null;
			if ( is_array( $global ) ) {
				$merged          = $global;
				$merged['id']    = $node['id'] ?? $global['id'];
				$merged['props'] = array_merge( $global['props'] ?? [], $node['props'] ?? [] );
				if ( ! empty( $node['styles'] ) ) {
					$merged['styles'] = $node['styles'];
				}
				$node = $merged;
			}
		}

		// Lo apagado con el interruptor de visibilidad solo se pinta en el
		// lienzo del constructor, que es donde hay que poder verlo para
		// volver a encenderlo. En la web publica y en la pestana «Preview»
		// —que es la web publica— no existe.
		if ( array_key_exists( 'visible', $node ) && ! $node['visible'] && ! $ctx->isCanvas ) {
			return '';
		}

		$type = $node['type'] ?? '';
		$def  = \Meridian\Components\Registry::get( $type );
		if ( ! $def ) {
			return '';
		}

		$props = array_merge( $def['defaults'] ?? [], $node['props'] ?? [] );

		// Antes de bajar, apuntar cuánto ancho le queda a lo de dentro.
		// Una columna de 4 pistas de 12 deja un tercio; una rejilla de
		// tres columnas, otro tercio de lo que ya hubiera. Las fotos lo
		// leen para decir en `sizes` lo que ocupan de verdad.
		$antes = $ctx->fraccion;
		if ( 'column' === $type ) {
			$span          = max( 1, min( 12, (int) ( $props['span'] ?? 12 ) ) );
			$ctx->fraccion = $antes * ( $span / 12 );
		} elseif ( 'columns' === $type ) {
			$cols          = max( 1, min( 6, (int) ( $props['desktop'] ?? 1 ) ) );
			$ctx->fraccion = $antes / $cols;
		}

		$childrenHtml = '';
		foreach ( $node['children'] ?? [] as $child ) {
			if ( is_array( $child ) ) {
				$childrenHtml .= self::render( $child, $ctx );
			}
		}
		$ctx->fraccion = $antes;

		return ComponentRenders::render( $type, $node, $props, $childrenHtml, $ctx );
	}

	public static function collect_global_ids( array $nodes ): array {
		$ids = [];
		$walk = static function ( array $list ) use ( &$ids, &$walk ) {
			foreach ( $list as $n ) {
				if ( ( $n['source'] ?? '' ) === 'global' && ! empty( $n['globalId'] ) ) {
					$ids[] = (int) $n['globalId'];
				}
				if ( ! empty( $n['children'] ) ) {
					$walk( $n['children'] );
				}
			}
		};
		$walk( $nodes );
		return array_values( array_unique( $ids ) );
	}
}

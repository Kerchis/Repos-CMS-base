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

		if ( array_key_exists( 'visible', $node ) && ! $node['visible'] && ! $ctx->isPreview ) {
			return '';
		}

		$type = $node['type'] ?? '';
		$def  = \Meridian\Components\Registry::get( $type );
		if ( ! $def ) {
			return '';
		}

		$props        = array_merge( $def['defaults'] ?? [], $node['props'] ?? [] );
		$childrenHtml = '';
		foreach ( $node['children'] ?? [] as $child ) {
			if ( is_array( $child ) ) {
				$childrenHtml .= self::render( $child, $ctx );
			}
		}

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

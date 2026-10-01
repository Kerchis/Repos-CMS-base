<?php
/**
 * Render context.
 *
 * @package Meridian
 */

namespace Meridian\Render;

defined( 'ABSPATH' ) || exit;

class RenderContext {

	public bool $isPreview = false;
	public array $globals = [];
	public array $media = [];
	public array $needed = [];
	public ?int $postId = null;
	public array $document = [];

	public function preview_attrs( string $id ): string {
		if ( ! $this->isPreview ) {
			return '';
		}
		return ' data-krg-id="' . esc_attr( $id ) . '"';
	}

	public function node_class( array $node ): string {
		$type = sanitize_html_class( $node['type'] ?? 'node' );
		$id   = sanitize_html_class( $node['id'] ?? '' );
		$vis  = ( array_key_exists( 'visible', $node ) && ! $node['visible'] ) ? ' is-hidden' : '';
		$hide = $node['hiddenOn'] ?? [];
		foreach ( [ 'desktop', 'tablet', 'mobile' ] as $bp ) {
			if ( ! empty( $hide[ $bp ] ) ) {
				$vis .= ' m-hide-' . $bp;
			}
		}
		return 'm-c-' . $type . ' m-n-' . $id . $vis;
	}

	public function attachment( int $id ): array {
		if ( isset( $this->media[ $id ] ) ) {
			return $this->media[ $id ];
		}
		$url = $id ? wp_get_attachment_image_url( $id, 'full' ) : '';
		$alt = $id ? (string) get_post_meta( $id, '_wp_attachment_image_alt', true ) : '';
		$this->media[ $id ] = [
			'id'  => $id,
			'url' => $url ?: '',
			'alt' => $alt,
		];
		return $this->media[ $id ];
	}
}

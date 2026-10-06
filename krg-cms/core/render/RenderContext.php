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
	/**
	 * Lienzo del constructor: hay que poder ver y seleccionar lo que
	 * todavía está vacío. En cualquier otro contexto, lo vacío no se
	 * imprime.
	 */
	public bool $isCanvas = false;
	public array $globals = [];
	public array $media = [];
	public array $needed = [];
	public ?int $postId = null;
	public array $document = [];
	/**
	 * Qué parte del ancho del contenido ocupa lo que se está pintando.
	 *
	 * Empieza en 1 —la sección entera— y se va estrechando al entrar en
	 * una columna de 4 de 12 (0.33) o en una rejilla de tres (otro
	 * tercio). Las fotos lo usan para declarar en `sizes` lo que de
	 * verdad ocupan y que el navegador no se baje el archivo grande
	 * para un hueco pequeño.
	 */
	public float $fraccion = 1.0;

	/**
	 * Marca de seleccion para el lienzo del constructor.
	 *
	 * Solo la usan el guion y el CSS del editor. En la pestana «Preview»
	 * sobra: alli la pagina tiene que salir igual que en la web publica,
	 * byte a byte.
	 */
	public function preview_attrs( string $id ): string {
		if ( ! $this->isCanvas ) {
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

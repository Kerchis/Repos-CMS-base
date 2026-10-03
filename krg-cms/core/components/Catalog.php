<?php
/**
 * Built-in component schemas.
 *
 * @package Meridian
 */

namespace Meridian\Components;

defined( 'ABSPATH' ) || exit;

class Catalog {

	public static function all(): array {
		return array_merge(
			self::layout(),
			self::text(),
			self::media(),
			self::buttons(),
			self::content(),
			self::brand(),
			self::blog(),
			self::forms(),
			self::other()
		);
	}

	/**
	 * Componentes del sistema visual de referencia.
	 *
	 * Es una capa opcional: si el archivo no está presente (despliegue
	 * parcial, copia incompleta del tema), el CMS sigue funcionando con los
	 * componentes base en lugar de provocar un error fatal.
	 */
	private static function brand(): array {
		return class_exists( BrandCatalog::class ) ? BrandCatalog::all() : [];
	}

	private static function f( string $key, string $type, string $group, string $label, array $extra = [] ): array {
		return array_merge(
			[
				'key'   => $key,
				'type'  => $type,
				'group' => $group,
				'label' => $label,
			],
			$extra
		);
	}

	/** @return array<int, array<string, mixed>> */
	private static function col_fields( int $max_d = 6, int $max_t = 4, int $max_m = 2 ): array {
		return [
			self::f( 'desktop', 'number', 'responsive', __( 'Columnas desktop', 'meridian' ), [ 'min' => 1, 'max' => $max_d ] ),
			self::f( 'tablet', 'number', 'responsive', __( 'Columnas tablet', 'meridian' ), [ 'min' => 1, 'max' => $max_t ] ),
			self::f( 'mobile', 'number', 'responsive', __( 'Columnas mobile', 'meridian' ), [ 'min' => 1, 'max' => $max_m ] ),
		];
	}

	private static function layout(): array {
		return [
			[
				'slug'        => 'section',
				'name'        => __( 'Sección', 'meridian' ),
				'description' => __( 'Bloque de página de ancho completo.', 'meridian' ),
				'category'    => 'layout',
				'icon'        => 'section',
				'children'    => '*',
				'supports'    => [ 'responsive', 'visibility' ],
				'defaults'    => [
					'fullWidth'  => true,
					'width'      => 'full',
					'minHeight'  => 'auto',
					'minHeightValue' => 60,
					'minHeightUnit'  => 'vh',
					'heightMode'     => 'exact',
					'vAlign'     => 'start',
					'headerSkin' => 'auto',
					'curtain'    => 'off',
				],
				'fields'      => [
					self::f( 'name', 'text', 'content', __( 'Nombre interno', 'meridian' ) ),
					self::f( 'fullWidth', 'toggle', 'design', __( 'Ancho completo', 'meridian' ) ),
					self::f(
						'minHeight',
						'select',
						'design',
						__( 'Altura mínima', 'meridian' ),
						[
							'options' => [
								[ 'value' => 'auto', 'label' => __( 'El del contenido', 'meridian' ) ],
								[ 'value' => 'screen', 'label' => __( 'Pantalla completa', 'meridian' ) ],
								[ 'value' => 'screen-minus-header', 'label' => __( 'Pantalla menos la cabecera', 'meridian' ) ],
								[ 'value' => 'tall', 'label' => __( 'Alta (78 %)', 'meridian' ) ],
								[ 'value' => 'half', 'label' => __( 'Media (50 %)', 'meridian' ) ],
								[ 'value' => 'custom', 'label' => __( 'A medida…', 'meridian' ) ],
							],
						]
					),
					self::f(
						'minHeightValue',
						'number',
						'design',
						__( 'Alto a medida', 'meridian' ),
						[
							'min'  => 1,
							'max'  => 4000,
							'help' => __( 'Solo con el alto «A medida». Es un mínimo: si el contenido no cabe, la sección crece.', 'meridian' ),
						]
					),
					self::f(
						'minHeightUnit',
						'select',
						'design',
						__( 'Unidad del alto', 'meridian' ),
						[
							'options' => [
								[ 'value' => 'vh', 'label' => __( '% de la altura de la pantalla', 'meridian' ) ],
								[ 'value' => 'px', 'label' => __( 'Píxeles', 'meridian' ) ],
							],
						]
					),
					self::f(
						'heightMode',
						'select',
						'design',
						__( '¿Quién manda en el alto?', 'meridian' ),
						[
							'options' => [
								[ 'value' => 'exact', 'label' => __( 'La sección: el contenido se adapta', 'meridian' ) ],
								[ 'value' => 'min', 'label' => __( 'El contenido: el alto es sólo un mínimo', 'meridian' ) ],
							],
							'help'    => __( 'Sólo con la altura «A medida». Si dentro tienes un panel partido o una portada a pantalla completa, con «La sección» se encogen para caber; con «El contenido» mandan ellos y la sección crece.', 'meridian' ),
						]
					),
					self::f(
						'vAlign',
						'select',
						'design',
						__( 'Alineación vertical', 'meridian' ),
						[
							'options' => [
								[ 'value' => 'start', 'label' => __( 'Arriba', 'meridian' ) ],
								[ 'value' => 'center', 'label' => __( 'Centro', 'meridian' ) ],
								[ 'value' => 'end', 'label' => __( 'Abajo', 'meridian' ) ],
								[ 'value' => 'stretch', 'label' => __( 'Estirar: el contenido llena el alto', 'meridian' ) ],
							],
							'help'    => __( 'Dónde se coloca el contenido cuando ocupa menos que el alto de la sección. Con «Estirar» no sobra fondo: el bloque crece hasta llenarla.', 'meridian' ),
						]
					),
					self::f(
						'width',
						'select',
						'design',
						__( 'Ancho del contenido', 'meridian' ),
						[
							'options' => [
								[ 'value' => 'full', 'label' => __( 'Todo el ancho, de borde a borde', 'meridian' ) ],
								[ 'value' => 'padded', 'label' => __( 'Todo el ancho, con margen lateral', 'meridian' ) ],
								[ 'value' => 'boxed', 'label' => __( 'Centrado y limitado', 'meridian' ) ],
							],
							'help'    => __( 'De borde a borde no deja ningún margen: el contenido llega al filo de la pantalla. Es lo que necesitan los mapas, los vídeos y las fotos a pantalla completa.', 'meridian' ),
						]
					),
					self::f(
						'headerSkin',
						'select',
						'design',
						__( 'Color de la cabecera sobre esta sección', 'meridian' ),
						[ 'options' => [ 'auto', 'dark', 'light', 'none' ] ]
					),
					self::f(
						'curtain',
						'select',
						'design',
						__( 'Efecto cortina', 'meridian' ),
						[
							'options' => [
								[ 'value' => 'off', 'label' => __( 'Sin cortina', 'meridian' ) ],
								[ 'value' => 'on', 'label' => __( 'Cortina (la siguiente sección la tapa)', 'meridian' ) ],
							],
							'help'    => __( 'La sección se queda quieta y la siguiente se desliza por encima, tapándola.', 'meridian' ),
						]
					),
					self::f( 'htmlId', 'text', 'advanced', __( 'ID HTML', 'meridian' ) ),
				],
			],
			[
				'slug'        => 'container',
				'name'        => __( 'Contenedor', 'meridian' ),
				'category'    => 'layout',
				'icon'        => 'container',
				'children'    => '*',
				'defaults'    => [ 'narrow' => false ],
				'fields'      => [
					self::f( 'narrow', 'toggle', 'design', __( 'Ancho estrecho', 'meridian' ) ),
				],
			],
			[
				'slug'        => 'row',
				'name'        => __( 'Fila', 'meridian' ),
				'description' => __( 'Agrupa columnas con anchos distintos.', 'meridian' ),
				'category'    => 'layout',
				'icon'        => 'row',
				'children'    => '*',
				'defaults'    => [ 'layout' => '12', 'gap' => 24, 'vAlign' => 'start' ],
				'fields'      => [
					self::f( 'layout', 'text', 'design', __( 'Disposición', 'meridian' ) ),
					self::f( 'gap', 'number', 'spacing', __( 'Separación (px)', 'meridian' ), [ 'min' => 0, 'max' => 80 ] ),
					self::f( 'vAlign', 'select', 'design', __( 'Alineación vertical', 'meridian' ), [ 'options' => [ 'start', 'center', 'end', 'stretch' ] ] ),
				],
			],
			[
				'slug'        => 'column',
				'name'        => __( 'Columna', 'meridian' ),
				'description' => __( 'Grupo de módulos dentro de una fila.', 'meridian' ),
				'category'    => 'layout',
				'icon'        => 'column',
				'children'    => '*',
				'defaults'    => [ 'span' => 12, 'spanTablet' => 12, 'spanMobile' => 12, 'contentVAlign' => 'start', 'contentHAlign' => 'start' ],
				'fields'      => [
					self::f( 'span', 'number', 'responsive', __( 'Ancho desktop (1–12)', 'meridian' ), [ 'min' => 1, 'max' => 12 ] ),
					self::f( 'spanTablet', 'number', 'responsive', __( 'Ancho tablet (1–12)', 'meridian' ), [ 'min' => 1, 'max' => 12 ] ),
					self::f( 'spanMobile', 'number', 'responsive', __( 'Ancho móvil (1–12)', 'meridian' ), [ 'min' => 1, 'max' => 12 ] ),
					self::f( 'contentVAlign', 'select', 'design', __( 'Alineación vertical del contenido', 'meridian' ), [ 'options' => [ 'start', 'center', 'end' ] ] ),
					self::f( 'contentHAlign', 'select', 'design', __( 'Alineación horizontal del contenido', 'meridian' ), [ 'options' => [ 'start', 'center', 'end' ] ] ),
				],
			],
			[
				'slug'        => 'columns',
				'name'        => __( 'Columnas iguales', 'meridian' ),
				'category'    => 'layout',
				'icon'        => 'columns',
				'children'    => '*',
				'defaults'    => [ 'desktop' => 4, 'tablet' => 2, 'mobile' => 1, 'gap' => '24' ],
				'fields'      => [
					self::f( 'desktop', 'number', 'responsive', __( 'Columnas desktop', 'meridian' ), [ 'min' => 1, 'max' => 6 ] ),
					self::f( 'tablet', 'number', 'responsive', __( 'Columnas tablet', 'meridian' ), [ 'min' => 1, 'max' => 6 ] ),
					self::f( 'mobile', 'number', 'responsive', __( 'Columnas mobile', 'meridian' ), [ 'min' => 1, 'max' => 4 ] ),
					self::f( 'gap', 'number', 'spacing', __( 'Gutter (px)', 'meridian' ), [ 'min' => 0, 'max' => 80 ] ),
				],
			],
			[
				'slug'     => 'spacer',
				'name'     => __( 'Espaciador', 'meridian' ),
				'category' => 'layout',
				'icon'     => 'spacer',
				'defaults' => [ 'height' => 48 ],
				'fields'   => [
					self::f( 'height', 'number', 'spacing', __( 'Alto (px)', 'meridian' ), [ 'min' => 0, 'max' => 400, 'responsive' => true ] ),
				],
			],
			[
				'slug'     => 'divider',
				'name'     => __( 'Separador', 'meridian' ),
				'category' => 'layout',
				'icon'     => 'divider',
				'defaults' => [ 'style' => 'solid' ],
				'fields'   => [
					self::f( 'style', 'select', 'design', __( 'Estilo', 'meridian' ), [ 'options' => [ 'solid', 'dashed' ] ] ),
				],
			],
		];
	}

	private static function text(): array {
		$tags = [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p' ];
		$align = [ 'left', 'center', 'right', 'justify' ];
		return [
			[
				'slug'     => 'hero',
				'name'     => __( 'Hero', 'meridian' ),
				'category' => 'content',
				'icon'     => 'hero',
				'defaults' => [
					'eyebrow'  => 'KRG CMS',
					'title'    => 'Construye sitios sin tocar código',
					'subtitle' => 'Un CMS con constructor visual, tokens de diseño y blog.',
					'align'    => 'left',
					'buttons'  => [
						[ 'text' => 'Crear página', 'url' => '#', 'variant' => 'primary' ],
						[ 'text' => 'Ver servicios', 'url' => '/servicios/', 'variant' => 'secondary' ],
					],
					'imageId'  => 0,
				],
				'fields'   => [
					self::f( 'eyebrow', 'text', 'content', __( 'Eyebrow', 'meridian' ) ),
					self::f( 'title', 'textarea', 'content', __( 'Título', 'meridian' ) ),
					self::f( 'subtitle', 'textarea', 'content', __( 'Subtítulo', 'meridian' ) ),
					self::f( 'align', 'alignment', 'design', __( 'Alineación', 'meridian' ), [ 'options' => $align ] ),
					self::f( 'imageId', 'image', 'content', __( 'Imagen', 'meridian' ) ),
					self::f(
						'buttons',
						'repeater',
						'content',
						__( 'Botones', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'text', 'text', 'content', __( 'Texto', 'meridian' ) ),
								self::f( 'url', 'url', 'content', __( 'URL', 'meridian' ) ),
								self::f( 'variant', 'select', 'design', __( 'Estilo', 'meridian' ), [ 'options' => [ 'primary', 'secondary', 'outline' ] ] ),
							],
						]
					),
				],
			],
			[
				'slug'     => 'heading',
				'name'     => __( 'Encabezado', 'meridian' ),
				'category' => 'text',
				'icon'     => 'heading',
				'defaults' => [ 'text' => 'Título', 'tag' => 'h2', 'align' => 'left', 'link' => '' ],
				'fields'   => [
					self::f( 'text', 'textarea', 'content', __( 'Texto', 'meridian' ) ),
					self::f( 'tag', 'htmlTag', 'content', __( 'Etiqueta', 'meridian' ), [ 'options' => $tags ] ),
					self::f( 'align', 'alignment', 'design', __( 'Alineación', 'meridian' ), [ 'options' => $align ] ),
					self::f( 'link', 'url', 'content', __( 'Enlace', 'meridian' ) ),
				],
			],
			[
				'slug'     => 'paragraph',
				'name'     => __( 'Párrafo', 'meridian' ),
				'category' => 'text',
				'icon'     => 'paragraph',
				'defaults' => [ 'text' => 'Escribe un párrafo.', 'align' => 'left' ],
				'fields'   => [
					self::f( 'text', 'textarea', 'content', __( 'Texto', 'meridian' ) ),
					self::f( 'align', 'alignment', 'design', __( 'Alineación', 'meridian' ), [ 'options' => $align ] ),
				],
			],
			[
				'slug'     => 'rich-text',
				'name'     => __( 'Texto enriquecido', 'meridian' ),
				'category' => 'text',
				'icon'     => 'rich',
				'defaults' => [ 'html' => '<p>Texto</p>' ],
				'fields'   => [
					self::f( 'html', 'richtext', 'content', __( 'Contenido', 'meridian' ) ),
				],
			],
			[
				'slug'     => 'eyebrow',
				'name'     => __( 'Eyebrow', 'meridian' ),
				'category' => 'text',
				'icon'     => 'eyebrow',
				'defaults' => [ 'text' => 'SECCIÓN' ],
				'fields'   => [
					self::f( 'text', 'text', 'content', __( 'Texto', 'meridian' ) ),
				],
			],
			[
				'slug'     => 'quote',
				'name'     => __( 'Cita', 'meridian' ),
				'category' => 'text',
				'icon'     => 'quote',
				'defaults' => [ 'text' => 'Una cita memorable.', 'cite' => '' ],
				'fields'   => [
					self::f( 'text', 'textarea', 'content', __( 'Cita', 'meridian' ) ),
					self::f( 'cite', 'text', 'content', __( 'Autor', 'meridian' ) ),
				],
			],
		];
	}

	private static function media(): array {
		return [
			[
				'slug'     => 'image',
				'name'     => __( 'Imagen', 'meridian' ),
				'category' => 'media',
				'icon'     => 'image',
				'defaults' => [
					'imageId'        => 0,
					'imageUrl'       => '',
					'alt'            => '',
					'radius'         => 'none',
					'objectFit'      => 'cover',
					'fillMode'       => 'natural',
					'scale'          => 100,
					'parallax'        => false,
					'parallaxZoom'    => 8,
					'parallaxAmount'  => 10,
					'parallaxInvert'  => false,
					'link'            => '',
					'linkTarget'      => '_self',
					'lightbox'        => false,
					'centerOnMobile'  => false,
				],
				'fields'   => [
					self::f( 'imageId', 'image', 'content', __( 'Imagen', 'meridian' ) ),
					self::f( 'imageUrl', 'url', 'content', __( 'URL de imagen', 'meridian' ) ),
					self::f( 'alt', 'text', 'content', __( 'Texto alternativo', 'meridian' ) ),
					self::f( 'link', 'url', 'content', __( 'Enlace', 'meridian' ) ),
					self::f( 'linkTarget', 'select', 'content', __( 'Destino', 'meridian' ), [ 'options' => [ '_self', '_blank' ] ] ),
					self::f( 'lightbox', 'toggle', 'content', __( 'Abrir en lightbox', 'meridian' ) ),
					self::f( 'centerOnMobile', 'toggle', 'design', __( 'Centrar en móvil', 'meridian' ) ),
					self::f( 'radius', 'select', 'design', __( 'Radio', 'meridian' ), [ 'options' => [ 'none', 'sm', 'md', 'lg', 'full' ] ] ),
					self::f( 'scale', 'number', 'design', __( 'Escala (%)', 'meridian' ), [ 'min' => 10, 'max' => 200 ] ),
					self::f( 'objectFit', 'select', 'design', __( 'Ajuste', 'meridian' ), [ 'options' => [ 'cover', 'contain', 'fill' ] ] ),
					self::f( 'fillMode', 'select', 'design', __( 'Relleno', 'meridian' ), [ 'options' => [ 'natural', 'fill' ] ] ),
					self::f( 'parallax', 'toggle', 'design', __( 'Efecto parallax', 'meridian' ) ),
					self::f( 'parallaxZoom', 'number', 'design', __( 'Ampliación parallax (%)', 'meridian' ), [ 'min' => 0, 'max' => 40 ] ),
					self::f( 'parallaxAmount', 'number', 'design', __( 'Intensidad parallax (%)', 'meridian' ), [ 'min' => 0, 'max' => 40 ] ),
					self::f( 'parallaxInvert', 'toggle', 'design', __( 'Invertir dirección', 'meridian' ) ),
				],
			],
			[
				'slug'     => 'gallery',
				'name'     => __( 'Galería', 'meridian' ),
				'category' => 'media',
				'icon'     => 'gallery',
				'defaults' => [
					'ids'       => '',
					'items'     => [],
					'layout'    => 'carousel',
					'fullWidth'  => false,
					'adaptSmall' => true,
					'height'     => 420,
					'objectFit' => 'cover',
					'arrows'    => true,
					'keyboard'  => true,
					'autoplay'       => false,
					'interval'       => 5000,
					'parallax'       => false,
					'parallaxZoom'   => 8,
					'parallaxAmount' => 10,
					'parallaxInvert' => false,
					'desktop'        => 3,
					'tablet'    => 2,
					'mobile'    => 1,
				],
				'fields'   => [
					self::f( 'ids', 'text', 'content', __( 'IDs (legado)', 'meridian' ) ),
					self::f(
						'items',
						'repeater',
						'content',
						__( 'Imágenes', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'imageId', 'image', 'content', __( 'Imagen', 'meridian' ) ),
								self::f( 'imageUrl', 'url', 'content', __( 'URL', 'meridian' ) ),
								self::f( 'alt', 'text', 'content', __( 'Texto alternativo', 'meridian' ) ),
							],
						]
					),
					self::f( 'layout', 'select', 'design', __( 'Presentación', 'meridian' ), [ 'options' => [ 'carousel', 'grid' ] ] ),
					self::f( 'fullWidth', 'toggle', 'design', __( 'Escritorio: cubrir toda la pantalla', 'meridian' ) ),
					self::f( 'adaptSmall', 'toggle', 'design', __( 'Tablet y móvil: adaptar tamaño', 'meridian' ) ),
					self::f( 'height', 'number', 'design', __( 'Alto (px)', 'meridian' ), [ 'min' => 120, 'max' => 900 ] ),
					self::f( 'objectFit', 'select', 'design', __( 'Ajuste', 'meridian' ), [ 'options' => [ 'cover', 'contain' ] ] ),
					self::f( 'arrows', 'toggle', 'design', __( 'Flechas', 'meridian' ) ),
					self::f( 'keyboard', 'toggle', 'design', __( 'Teclado', 'meridian' ) ),
					self::f( 'autoplay', 'toggle', 'design', __( 'Reproducción automática', 'meridian' ) ),
					self::f( 'interval', 'number', 'design', __( 'Intervalo (ms)', 'meridian' ), [ 'min' => 1500, 'max' => 15000 ] ),
					self::f( 'parallax', 'toggle', 'design', __( 'Efecto parallax', 'meridian' ) ),
					self::f( 'parallaxZoom', 'number', 'design', __( 'Ampliación parallax (%)', 'meridian' ), [ 'min' => 0, 'max' => 40 ] ),
					self::f( 'parallaxAmount', 'number', 'design', __( 'Intensidad parallax (%)', 'meridian' ), [ 'min' => 0, 'max' => 40 ] ),
					self::f( 'parallaxInvert', 'toggle', 'design', __( 'Invertir dirección', 'meridian' ) ),
					...self::col_fields( 6, 4, 2 ),
				],
			],
			[
				'slug'     => 'video',
				'name'     => __( 'Video', 'meridian' ),
				'category' => 'media',
				'icon'     => 'video',
				'defaults' => [
					'source'   => 'link',
					'url'      => '',
					'videoId'  => 0,
					'videoUrl' => '',
					'sizeMode' => 'auto',
					'width'    => 100,
					'height'   => 420,
					'fit'      => 'cover',
					'autoplay' => true,
					'loop'     => true,
					'volume'   => 70,
				],
				'fields'   => [
					self::f( 'source', 'select', 'content', __( 'Origen', 'meridian' ), [ 'options' => [ 'link', 'upload' ] ] ),
					self::f( 'url', 'url', 'content', __( 'URL del video', 'meridian' ) ),
					self::f( 'videoId', 'number', 'content', __( 'ID de archivo', 'meridian' ), [ 'min' => 0, 'max' => 999999999 ] ),
					self::f( 'videoUrl', 'url', 'content', __( 'URL de archivo', 'meridian' ) ),
					self::f( 'sizeMode', 'select', 'design', __( 'Tamaño', 'meridian' ), [ 'options' => [ 'auto', 'full', 'fullWidth', 'fullHeight', 'custom' ] ] ),
					self::f( 'width', 'number', 'design', __( 'Ancho', 'meridian' ), [ 'min' => 0, 'max' => 2000 ] ),
					self::f( 'height', 'number', 'design', __( 'Alto (px)', 'meridian' ), [ 'min' => 80, 'max' => 1200 ] ),
					self::f( 'fit', 'select', 'design', __( 'Ajuste', 'meridian' ), [ 'options' => [ 'cover', 'contain' ] ] ),
					self::f( 'autoplay', 'toggle', 'design', __( 'Reproducción automática', 'meridian' ) ),
					self::f( 'loop', 'toggle', 'design', __( 'Repetir', 'meridian' ) ),
					self::f( 'volume', 'number', 'design', __( 'Volumen (%)', 'meridian' ), [ 'min' => 0, 'max' => 100 ] ),
				],
			],
		];
	}

	private static function buttons(): array {
		return [
			[
				'slug'     => 'button',
				'name'     => __( 'Botón', 'meridian' ),
				'category' => 'buttons',
				'icon'     => 'button',
				'defaults' => [ 'text' => 'Acción', 'url' => '#', 'target' => '_self', 'variant' => 'primary' ],
				'fields'   => [
					self::f( 'text', 'text', 'content', __( 'Texto', 'meridian' ) ),
					self::f( 'url', 'url', 'content', __( 'URL', 'meridian' ) ),
					self::f( 'target', 'select', 'content', __( 'Target', 'meridian' ), [ 'options' => [ '_self', '_blank' ] ] ),
					self::f( 'variant', 'select', 'design', __( 'Estilo', 'meridian' ), [ 'options' => [ 'primary', 'secondary', 'outline', 'ghost' ] ] ),
				],
			],
			[
				'slug'     => 'button-group',
				'name'     => __( 'Grupo de botones', 'meridian' ),
				'category' => 'buttons',
				'icon'     => 'buttons',
				'children' => [ 'button' ],
				'defaults' => [ 'align' => 'left' ],
				'fields'   => [
					self::f( 'align', 'alignment', 'design', __( 'Alineación', 'meridian' ), [ 'options' => [ 'left', 'center', 'right' ] ] ),
				],
			],
		];
	}

	private static function content(): array {
		$card_fields = [
			self::f( 'title', 'text', 'content', __( 'Título', 'meridian' ) ),
			self::f( 'text', 'textarea', 'content', __( 'Texto', 'meridian' ) ),
			self::f( 'imageId', 'image', 'content', __( 'Imagen', 'meridian' ) ),
			self::f( 'imageUrl', 'url', 'content', __( 'URL de imagen', 'meridian' ) ),
			self::f( 'url', 'url', 'content', __( 'Enlace', 'meridian' ) ),
		];
		return [
			[
				'slug'     => 'card',
				'name'     => __( 'Card', 'meridian' ),
				'category' => 'content',
				'icon'     => 'card',
				'defaults' => [ 'title' => 'Card', 'text' => 'Descripción', 'imageId' => 0, 'imageUrl' => '', 'url' => '' ],
				'fields'   => $card_fields,
			],
			[
				'slug'     => 'cards-grid',
				'name'     => __( 'Grid de cards', 'meridian' ),
				'category' => 'content',
				'icon'     => 'cards',
				'defaults' => [
					'desktop' => 4,
					'tablet'  => 2,
					'mobile'  => 1,
					'items'   => [
						[ 'title' => 'Uno', 'text' => 'Descripción breve.' ],
						[ 'title' => 'Dos', 'text' => 'Descripción breve.' ],
						[ 'title' => 'Tres', 'text' => 'Descripción breve.' ],
						[ 'title' => 'Cuatro', 'text' => 'Descripción breve.' ],
					],
				],
				'fields'   => [
					...self::col_fields( 6, 4, 2 ),
					self::f( 'items', 'repeater', 'content', __( 'Cards', 'meridian' ), [ 'itemFields' => $card_fields ] ),
				],
			],
			[
				'slug'     => 'feature',
				'name'     => __( 'Feature', 'meridian' ),
				'category' => 'content',
				'icon'     => 'feature',
				'defaults' => [ 'title' => 'Feature', 'text' => '', 'icon' => '★' ],
				'fields'   => [
					self::f( 'icon', 'text', 'content', __( 'Ícono / emoji', 'meridian' ) ),
					self::f( 'title', 'text', 'content', __( 'Título', 'meridian' ) ),
					self::f( 'text', 'textarea', 'content', __( 'Texto', 'meridian' ) ),
				],
			],
			[
				'slug'     => 'feature-grid',
				'name'     => __( 'Grid de features', 'meridian' ),
				'category' => 'content',
				'icon'     => 'features',
				'defaults' => [
					'desktop' => 3,
					'tablet'  => 2,
					'mobile'  => 1,
					'items'   => [
						[ 'icon' => '◆', 'title' => 'Modular', 'text' => 'Componentes reutilizables.' ],
						[ 'icon' => '●', 'title' => 'Tokens', 'text' => 'Identidad centralizada.' ],
						[ 'icon' => '▲', 'title' => 'SEO', 'text' => 'HTML semántico.' ],
					],
				],
				'fields'   => [
					...self::col_fields( 4, 3, 2 ),
					self::f(
						'items',
						'repeater',
						'content',
						__( 'Items', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'icon', 'text', 'content', __( 'Ícono', 'meridian' ) ),
								self::f( 'title', 'text', 'content', __( 'Título', 'meridian' ) ),
								self::f( 'text', 'textarea', 'content', __( 'Texto', 'meridian' ) ),
							],
						]
					),
				],
			],
			[
				'slug'     => 'testimonials',
				'name'     => __( 'Testimonios', 'meridian' ),
				'category' => 'content',
				'icon'     => 'quote',
				'defaults' => [
					'items' => [
						[ 'text' => 'Excelente plataforma.', 'cite' => 'Ana P.' ],
						[ 'text' => 'Editamos todo sin código.', 'cite' => 'Luis M.' ],
					],
				],
				'fields'   => [
					self::f(
						'items',
						'repeater',
						'content',
						__( 'Testimonios', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'text', 'textarea', 'content', __( 'Cita', 'meridian' ) ),
								self::f( 'cite', 'text', 'content', __( 'Autor', 'meridian' ) ),
							],
						]
					),
				],
			],
			[
				'slug'     => 'faq',
				'name'     => __( 'FAQ', 'meridian' ),
				'category' => 'content',
				'icon'     => 'faq',
				'defaults' => [
					'items' => [
						[ 'q' => '¿Puedo cambiar los colores?', 'a' => 'Sí, desde Apariencia → Colores.' ],
						[ 'q' => '¿Necesito Elementor?', 'a' => 'No. KRG CMS es el constructor.' ],
					],
				],
				'fields'   => [
					self::f(
						'items',
						'repeater',
						'content',
						__( 'Preguntas', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'q', 'text', 'content', __( 'Pregunta', 'meridian' ) ),
								self::f( 'a', 'textarea', 'content', __( 'Respuesta', 'meridian' ) ),
							],
						]
					),
				],
			],
			[
				'slug'     => 'accordion',
				'name'     => __( 'Acordeón', 'meridian' ),
				'category' => 'content',
				'icon'     => 'accordion',
				'defaults' => [ 'items' => [ [ 'q' => 'Ítem', 'a' => 'Contenido' ] ] ],
				'fields'   => [
					self::f(
						'items',
						'repeater',
						'content',
						__( 'Ítems', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'q', 'text', 'content', __( 'Título', 'meridian' ) ),
								self::f( 'a', 'textarea', 'content', __( 'Contenido', 'meridian' ) ),
							],
						]
					),
				],
			],
			[
				'slug'     => 'tabs',
				'name'     => __( 'Tabs', 'meridian' ),
				'category' => 'content',
				'icon'     => 'tabs',
				'defaults' => [
					'items' => [
						[ 'q' => 'Uno', 'a' => 'Contenido uno' ],
						[ 'q' => 'Dos', 'a' => 'Contenido dos' ],
					],
				],
				'fields'   => [
					self::f(
						'items',
						'repeater',
						'content',
						__( 'Tabs', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'q', 'text', 'content', __( 'Etiqueta', 'meridian' ) ),
								self::f( 'a', 'textarea', 'content', __( 'Contenido', 'meridian' ) ),
							],
						]
					),
				],
			],
			[
				'slug'     => 'statistics',
				'name'     => __( 'Estadísticas', 'meridian' ),
				'category' => 'content',
				'icon'     => 'stats',
				'defaults' => [
					'desktop' => 3,
					'tablet'  => 3,
					'mobile'  => 1,
					'items'   => [
						[ 'q' => '120', 'a' => 'Proyectos' ],
						[ 'q' => '15', 'a' => 'Años' ],
						[ 'q' => '98%', 'a' => 'Satisfacción' ],
					],
				],
				'fields'   => [
					...self::col_fields( 4, 4, 2 ),
					self::f(
						'items',
						'repeater',
						'content',
						__( 'Métricas', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'q', 'text', 'content', __( 'Valor', 'meridian' ) ),
								self::f( 'a', 'text', 'content', __( 'Etiqueta', 'meridian' ) ),
							],
						]
					),
				],
			],
			[
				'slug'     => 'timeline',
				'name'     => __( 'Timeline', 'meridian' ),
				'category' => 'content',
				'icon'     => 'timeline',
				'defaults' => [
					'items' => [
						[ 'q' => '2018', 'a' => 'Fundación' ],
						[ 'q' => '2024', 'a' => 'Nueva plataforma' ],
					],
				],
				'fields'   => [
					self::f(
						'items',
						'repeater',
						'content',
						__( 'Hitos', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'q', 'text', 'content', __( 'Año / título', 'meridian' ) ),
								self::f( 'a', 'textarea', 'content', __( 'Descripción', 'meridian' ) ),
							],
						]
					),
				],
			],
			[
				'slug'     => 'cta',
				'name'     => __( 'CTA', 'meridian' ),
				'category' => 'content',
				'icon'     => 'cta',
				'defaults' => [
					'title'    => 'Hablemos de tu proyecto',
					'subtitle' => 'Construye páginas, blogs e identidad desde un solo panel.',
					'text'     => 'Contactar',
					'url'      => '/contacto/',
				],
				'fields'   => [
					self::f( 'title', 'text', 'content', __( 'Título', 'meridian' ) ),
					self::f( 'subtitle', 'textarea', 'content', __( 'Texto', 'meridian' ) ),
					self::f( 'text', 'text', 'content', __( 'Botón', 'meridian' ) ),
					self::f( 'url', 'url', 'content', __( 'URL', 'meridian' ) ),
				],
			],
		];
	}

	private static function blog(): array {
		return [
			[
				'slug'     => 'blog-grid',
				'name'     => __( 'Grid de blog', 'meridian' ),
				'category' => 'blog',
				'icon'     => 'blog',
				'defaults' => [ 'count' => 6, 'desktop' => 3, 'tablet' => 2, 'mobile' => 1 ],
				'fields'   => [
					self::f( 'count', 'number', 'content', __( 'Cantidad', 'meridian' ), [ 'min' => 1, 'max' => 24 ] ),
					...self::col_fields( 4, 3, 2 ),
				],
			],
			[
				'slug'     => 'recent-posts',
				'name'     => __( 'Posts recientes', 'meridian' ),
				'category' => 'blog',
				'icon'     => 'blog',
				'defaults' => [ 'count' => 3 ],
				'fields'   => [
					self::f( 'count', 'number', 'content', __( 'Cantidad', 'meridian' ), [ 'min' => 1, 'max' => 10 ] ),
				],
			],
			[
				'slug'     => 'related-posts',
				'name'     => __( 'Posts relacionados', 'meridian' ),
				'category' => 'blog',
				'icon'     => 'blog',
				'defaults' => [ 'count' => 3 ],
				'fields'   => [
					self::f( 'count', 'number', 'content', __( 'Cantidad', 'meridian' ), [ 'min' => 1, 'max' => 6 ] ),
				],
			],
			[
				'slug'     => 'categories',
				'name'     => __( 'Categorías', 'meridian' ),
				'category' => 'blog',
				'icon'     => 'blog',
				'defaults' => [],
				'fields'   => [],
			],
			[
				'slug'     => 'blog-post',
				'name'     => __( 'Artículo (contenido)', 'meridian' ),
				'category' => 'blog',
				'icon'     => 'blog',
				'defaults' => [],
				'fields'   => [],
			],
		];
	}

	public static function everest_form_options(): array {
		$opts = [
			[ 'value' => '0', 'label' => __( '— Elegir formulario —', 'meridian' ) ],
		];
		if ( ! post_type_exists( 'everest_form' ) ) {
			return $opts;
		}
		$posts = get_posts(
			[
				'post_type'        => 'everest_form',
				'post_status'      => [ 'publish', 'draft' ],
				'posts_per_page'   => 200,
				'orderby'          => 'title',
				'order'            => 'ASC',
				'suppress_filters' => true,
			]
		);
		foreach ( $posts as $p ) {
			$title  = $p->post_title ? $p->post_title : ( '#' . $p->ID );
			$opts[] = [
				'value' => (string) (int) $p->ID,
				'label' => $title,
			];
		}
		return $opts;
	}

	private static function forms(): array {
		$everest_on = post_type_exists( 'everest_form' ) || shortcode_exists( 'everest_form' );
		return [
			[
				'slug'     => 'contact-form',
				'name'     => __( 'Formulario de contacto', 'meridian' ),
				'category' => 'forms',
				'icon'     => 'form',
				'defaults' => [
					'submit'        => 'Enviar',
					'success'       => 'Mensaje enviado. Gracias.',
					'showPhone'     => true,
					'showSubject'   => true,
					'showMessage'   => true,
					'style'         => 'boxed',
					'optIns'        => [],
					'consent'       => '',
				],
				'fields'   => [
					self::f( 'submit', 'text', 'content', __( 'Texto del botón', 'meridian' ) ),
					self::f( 'success', 'text', 'content', __( 'Mensaje de éxito', 'meridian' ) ),
					self::f( 'showPhone', 'toggle', 'content', __( 'Campo teléfono', 'meridian' ) ),
					self::f( 'showSubject', 'toggle', 'content', __( 'Campo asunto', 'meridian' ) ),
					self::f( 'showMessage', 'toggle', 'content', __( 'Campo mensaje', 'meridian' ) ),
					self::f( 'style', 'select', 'design', __( 'Estilo de campos', 'meridian' ), [ 'options' => [ 'boxed', 'underline' ] ] ),
					self::f(
						'optIns',
						'repeater',
						'content',
						__( 'Casillas de suscripción', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'label', 'text', 'content', __( 'Etiqueta', 'meridian' ) ),
								self::f( 'required', 'toggle', 'content', __( 'Obligatoria', 'meridian' ) ),
							],
						]
					),
					self::f( 'consent', 'textarea', 'content', __( 'Texto legal bajo el formulario', 'meridian' ) ),
				],
			],
			[
				'slug'         => 'everest-form',
				'name'         => __( 'Everest Forms', 'meridian' ),
				'category'     => 'forms',
				'icon'         => 'form',
				'pluginActive' => $everest_on,
				'defaults'     => [ 'formId' => 0 ],
				'fields'       => [
					self::f( 'formId', 'number', 'content', __( 'Formulario', 'meridian' ), [ 'min' => 0, 'max' => 999999999 ] ),
				],
			],
		];
	}

	private static function other(): array {
		return [
			[
				'slug'     => 'map',
				'name'     => __( 'Google Maps', 'meridian' ),
				'category' => 'other',
				'icon'     => 'map',
				'defaults' => [ 'url' => '', 'height' => 360, 'heightUnit' => 'px', 'ratio' => 'fixed' ],
				'fields'   => [
					self::f(
						'url',
						'mapsUrl',
						'content',
						__( 'URL o iframe de Google Maps', 'meridian' ),
						[ 'help' => __( 'Pega el «Insertar un mapa» completo de Google Maps o el enlace para compartir. Se queda solo con la dirección; el alto lo controlas aquí abajo, no el que trae pegado.', 'meridian' ) ]
					),
					self::f(
						'height',
						'number',
						'design',
						__( 'Alto del mapa', 'meridian' ),
						[ 'min' => 1, 'max' => 4000 ]
					),
					self::f(
						'heightUnit',
						'select',
						'design',
						__( 'Unidad del alto', 'meridian' ),
						[
							'options' => [
								[ 'value' => 'px', 'label' => __( 'Píxeles', 'meridian' ) ],
								[ 'value' => 'vh', 'label' => __( '% de la altura de la pantalla', 'meridian' ) ],
							],
						]
					),
				],
			],
			[
				'slug'     => 'social-links',
				'name'     => __( 'Redes sociales', 'meridian' ),
				'category' => 'navigation',
				'icon'     => 'share',
				'defaults' => [
					'items' => [
						[ 'q' => 'Instagram', 'a' => 'https://instagram.com' ],
						[ 'q' => 'LinkedIn', 'a' => 'https://linkedin.com' ],
					],
				],
				'fields'   => [
					self::f(
						'items',
						'repeater',
						'content',
						__( 'Enlaces', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'q', 'text', 'content', __( 'Red', 'meridian' ) ),
								self::f( 'a', 'url', 'content', __( 'URL', 'meridian' ) ),
							],
						]
					),
				],
			],
			[
				'slug'     => 'logo-grid',
				'name'     => __( 'Grid de logos', 'meridian' ),
				'category' => 'other',
				'icon'     => 'logos',
				'defaults' => [ 'ids' => '', 'desktop' => 5, 'tablet' => 3, 'mobile' => 2 ],
				'fields'   => [
					self::f( 'ids', 'text', 'content', __( 'IDs de imagen (coma)', 'meridian' ) ),
					...self::col_fields( 6, 4, 3 ),
				],
			],
			[
				'slug'     => 'menu',
				'name'     => __( 'Menú', 'meridian' ),
				'category' => 'navigation',
				'icon'     => 'menu',
				'defaults' => [
					'slug'            => 'header',
					'navModeDesktop'  => 'bar',
					'navModeTablet'   => 'bar',
					'navModeMobile'   => 'drawer',
				],
				'fields'   => [
					self::f( 'slug', 'text', 'content', __( 'Slug del menú', 'meridian' ) ),
					self::f( 'navModeDesktop', 'select', 'design', __( 'Tipo en escritorio', 'meridian' ), [ 'options' => [ 'bar', 'drawer' ] ] ),
					self::f( 'navModeTablet', 'select', 'design', __( 'Tipo en tablet', 'meridian' ), [ 'options' => [ 'bar', 'drawer' ] ] ),
					self::f( 'navModeMobile', 'select', 'design', __( 'Tipo en móvil', 'meridian' ), [ 'options' => [ 'bar', 'drawer' ] ] ),
				],
			],
			[
				'slug'     => 'search-form',
				'name'     => __( 'Buscador', 'meridian' ),
				'category' => 'other',
				'icon'     => 'search',
				'defaults' => [],
				'fields'   => [],
			],
		];
	}
}

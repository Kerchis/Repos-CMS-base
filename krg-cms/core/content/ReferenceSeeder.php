<?php
/**
 * Páginas de arranque construidas con la librería de componentes del sistema
 * visual de referencia.
 *
 * IMPORTANTE: esto es *contenido*, no diseño. Cada nodo que se crea aquí es un
 * componente registrado y 100 % editable desde el constructor: el usuario puede
 * cambiar textos, imágenes, variantes, colores, orden o eliminar secciones.
 * El archivo existe para que una instalación nueva arranque con el lenguaje
 * visual de las referencias ya montado, no para fijarlo.
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

class ReferenceSeeder {

	/* ------------------------------------------------------------------ */
	/* Helpers de construcción                                             */
	/* ------------------------------------------------------------------ */

	private static function nid( string $p = 'n' ): string {
		return $p . '_' . wp_generate_uuid4();
	}

	public static function node( string $type, array $props = [], array $children = [], array $extra = [] ): array {
		return array_merge(
			[
				'id'       => self::nid( 'section' === $type ? 'sec' : 'cmp' ),
				'type'     => $type,
				'visible'  => true,
				'source'   => 'local',
				'props'    => $props,
				'styles'   => [ 'desktop' => [], 'tablet' => [], 'mobile' => [] ],
				'children' => $children,
			],
			$extra
		);
	}

	/**
	 * Sección a sangre: envuelve módulos del sistema sin añadir contenedor ni
	 * padding propios (ver `.m-bleed` en assets/css/modules.css).
	 */
	public static function bleed( string $name, array $children ): array {
		return self::node(
			'section',
			[ 'name' => $name, 'fullWidth' => true ],
			$children,
			[ 'name' => $name, 'htmlClass' => 'm-bleed' ]
		);
	}

	/** Sección normal, con contenedor y ritmo vertical estándar. */
	public static function section( string $name, array $children, array $props = [] ): array {
		return self::node( 'section', array_merge( [ 'name' => $name ], $props ), $children, [ 'name' => $name ] );
	}

	private static function btn( string $text, string $url, string $variant = 'primary' ): array {
		return [ 'text' => $text, 'url' => $url, 'variant' => $variant, 'target' => '_self' ];
	}

	/** Marquesina reutilizada en varias páginas. */
	private static function strip( string $text, string $variant = 'solid', string $size = 'md' ): array {
		return self::bleed(
			'Marquesina',
			[
				self::node(
					'marquee',
					[
						'items'      => [
							[ 'text' => $text, 'url' => '' ],
							[ 'text' => $text, 'url' => '' ],
							[ 'text' => $text, 'url' => '' ],
						],
						'separator'  => 'star',
						'variant'    => $variant,
						'size'       => $size,
						'speed'      => 38,
						'direction'  => 'left',
						'pauseHover' => true,
					]
				),
			]
		);
	}

	/** Carril de productos reutilizado en Inicio, Nosotros y Cocina. */
	private static function bestsellers(): array {
		return self::bleed(
			'Más vendidos',
			[
				self::node(
					'product-rail',
					[
						'eyebrow'   => 'DE NUESTRA FAMILIA A LA TUYA',
						'title'     => 'NUESTROS MÁS VENDIDOS',
						'titleTag'  => 'h2',
						'tracking'  => 'normal',
						'align'     => 'center',
						'linkText'  => 'VER MÁS PRODUCTOS',
						'linkUrl'   => '/productos/',
						'desktop'   => 4,
						'tablet'    => 2,
						'mobile'    => 1,
						'layout'    => 'rail',
						'cardStyle' => 'soft',
						'arrows'    => true,
						'theme'     => 'cream',
						'items'     => [
							[ 'title' => 'FORMATO 340 G', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '/productos/', 'badge' => '' ],
							[ 'title' => 'FORMATO 450 G', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '/productos/', 'badge' => '' ],
							[ 'title' => 'MONODOSIS (20 UD.)', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '/productos/', 'badge' => 'NUEVO' ],
							[ 'title' => 'FORMATO 680 G', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '/productos/', 'badge' => '' ],
							[ 'title' => 'CREMA 340 G', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '/productos/', 'badge' => '' ],
						],
					]
				),
			]
		);
	}

	/** Carrusel de reseñas reutilizado en Inicio y Productos. */
	private static function reviews(): array {
		return self::bleed(
			'Reseñas',
			[
				self::node(
					'review-slider',
					[
						'eyebrow'  => '',
						'title'    => 'OPINIONES HONESTAS',
						'titleTag' => 'h2',
						'tracking' => 'wide',
						'align'    => 'center',
						'linkText' => 'VER TODAS LAS RESEÑAS',
						'linkUrl'  => '#',
						'perView'  => 2,
						'autoplay' => true,
						'interval' => 6000,
						'theme'    => 'surface',
						'items'    => [
							[ 'text' => 'NO TODA LA MIEL ES IGUAL. ESTA ES SUAVE Y DELICIOSA.', 'author' => 'MEL', 'source' => 'CLIENTE', 'rating' => 5 ],
							[ 'text' => 'ME ENCANTA. SOSTENIBLE Y RASTREABLE.', 'author' => 'MONTY', 'source' => 'CLIENTE', 'rating' => 5 ],
							[ 'text' => 'SABROSA Y TRAZABLE. EL ÚNICO PRODUCTO QUE ME HA HECHO DEJAR UNA RESEÑA.', 'author' => 'SEAN', 'source' => 'CLIENTE', 'rating' => 5 ],
							[ 'text' => 'EL SABOR ES DULCE, CON UN AROMA FLORAL ESTUPENDO.', 'author' => 'T.', 'source' => 'CLIENTE', 'rating' => 5 ],
						],
					]
				),
			]
		);
	}

	/** CTA final reutilizado en varias páginas. */
	private static function store_cta(): array {
		return self::bleed(
			'CTA tienda',
			[
				self::node(
					'statement-cta',
					[
						'eyebrow'    => '',
						'title'      => 'MIEL REALMENTE TRAZABLE CERCA DE TI',
						'text'       => '',
						'buttonText' => 'ENCONTRAR TIENDA',
						'buttonUrl'  => '/contacto/',
						'iconId'     => 0,
						'iconCount'  => 0,
						'imageId'    => 0,
						'overlay'    => 40,
						'theme'      => 'forest',
						'align'      => 'center',
					]
				),
			]
		);
	}


	/** Panel partido a pantalla completa (portada o ficha destacada). */
	private static function split_hero(): array {
		return self::bleed(
			'Panel partido',
			[
				self::node(
					'split-panel',
					[
						'eyebrow'     => '',
						'title'       => "RASTREA EL VIAJE\nDE TU MIEL",
						'titleTag'    => 'h2',
						'subtitle'    => 'DE LA FLOR A LA COLMENA, DE LA COSECHA A TI.',
						'text'        => '',
						'buttonText'  => 'EMPEZAR',
						'buttonUrl'   => '#rastrea-tu-miel',
						'buttonStyle' => 'solid',
						'buttonArrow' => true,
						'badgeId'     => 0,
						'badgePos'    => 'title',
						'mediaSide'   => 'right',
						'ratio'       => 'half',
						'height'      => 'screen',
						'mediaFit'    => 'cover',
						'mediaTheme'  => 'surface',
						'theme'       => 'cream',
						'align'       => 'center',
						'tracking'    => 'normal',
						'reveal'      => 'fade',
						'arrows'      => true,
						'dots'        => true,
						'autoplay'    => false,
						'interval'    => 6000,
						'items'       => [],
					]
				),
			]
		);
	}

	/** Panel partido de producto, con carrusel de imágenes. */
	private static function product_panel(): array {
		return self::bleed(
			'Producto destacado',
			[
				self::node(
					'split-panel',
					[
						'eyebrow'     => 'MIEL CRUDA TRAZABLE',
						'title'       => 'FORMATO 340 G',
						'titleTag'    => 'h2',
						'subtitle'    => '',
						'text'        => '',
						'buttonText'  => 'COMPRAR',
						'buttonUrl'   => '/productos/',
						'buttonStyle' => 'outline',
						'buttonArrow' => false,
						'badgeId'     => 0,
						'badgePos'    => 'top',
						'mediaSide'   => 'right',
						'ratio'       => 'half',
						'height'      => 'tall',
						'mediaFit'    => 'contain',
						'mediaTheme'  => 'surface',
						'theme'       => 'dark',
						'align'       => 'center',
						'tracking'    => 'normal',
						'reveal'      => 'fade',
						'arrows'      => true,
						'dots'        => true,
						'autoplay'    => false,
						'interval'    => 6000,
						'items'       => [],
					]
				),
			]
		);
	}

	/** Logotipo tipográfico monumental para cierre de página. */
	private static function wordmark_block(): array {
		return self::bleed(
			'Logotipo tipográfico',
			[
				self::node(
					'wordmark',
					[
						'text'        => strtoupper( (string) get_bloginfo( 'name' ) ),
						'tag'         => 'p',
						'url'         => '/',
						'fit'         => 'fill',
						'size'        => 'display',
						'tracking'    => 'normal',
						'align'       => 'center',
						'shadow'      => 'offset',
						'shadowColor' => [ 'mode' => 'token', 'token' => 'color.tertiary' ],
						'shadowX'     => 6,
						'shadowY'     => 6,
						'textColor'   => [ 'mode' => 'token', 'token' => 'color.text' ],
						'theme'       => 'cream',
						'reveal'      => 'fade',
					],
					[],
					[ 'animation' => 'rise', 'animDuration' => 900 ]
				),
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* Documentos de página                                                */
	/* ------------------------------------------------------------------ */

	public static function home(): array {
		return [
			self::bleed(
				'Pantalla de carga',
				[
					self::node(
						'preloader',
						[
							'label'     => 'RECOGIENDO NÉCTAR…',
							'claim'     => 'PREPÁRATE PARA MIEL HONESTA.',
							'imageId'   => 0,
							'duration'  => 1600,
							'once'      => true,
							'showCount' => true,
						]
					),
				]
			),
			self::bleed(
				'Hero',
				[
					self::node(
						'brand-hero',
						[
							'variant'       => 'center',
							'eyebrow'       => '',
							'title'         => "CONOCE\nTU MIEL",
							'subtitle'      => 'SABOR QUE PUEDES RASTREAR.',
							'subtitle2'     => 'DESDE LA CASA DE LA MIEL.',
							'text'          => '',
							'buttons'       => [ self::btn( 'RASTREA TU BOTE', '#rastrea-tu-miel', 'primary' ) ],
							'imageId'       => 0,
							'mobileImageId' => 0,
							'overlay'       => 25,
							'height'        => 'tall',
							'theme'         => 'cream',
							'scrollHint'    => true,
						]
					),
				]
			),
			self::strip( 'HECHO AQUÍ', 'solid', 'md' ),
			self::split_hero(),
			self::bleed(
				'Trazabilidad',
				[
					self::node(
						'trace-module',
						[
							'eyebrow'     => '',
							'title'       => 'RASTREA EL VIAJE DE TU MIEL',
							'titleTag'    => 'h2',
							'text'        => 'De la flor a la colmena, de la colmena a la cosecha, y de ahí hasta tu mesa.',
							'placeholder' => 'Código de lote',
							'buttonText'  => 'EMPEZAR',
							'helpText'    => 'Encontrarás el código impreso en la etiqueta del bote.',
							'errorText'   => 'No encontramos ese código. Revísalo e inténtalo de nuevo.',
							'demoCode'    => '',
							'imageId'     => 0,
							'theme'       => 'forest',
							'align'       => 'center',
							'steps'       => [
								[ 'title' => 'FLOR', 'text' => 'Las fuentes florales que visitaron las abejas.', 'meta' => 'Origen', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'COLMENA', 'text' => 'Dónde estaban asentadas las colmenas.', 'meta' => 'Ubicación', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'COSECHA', 'text' => 'Cuándo y cómo se extrajo la miel.', 'meta' => 'Extracción', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'TU CASA', 'text' => 'Dónde se envasó tu bote concreto.', 'meta' => 'Envasado', 'imageId' => 0, 'alt' => '' ],
							],
						],
						[],
						[ 'htmlId' => 'rastrea-tu-miel' ]
					),
				]
			),
			self::bestsellers(),
			self::bleed(
				'Historia',
				[
					self::node(
						'split-feature',
						[
							'eyebrow'    => 'DE SU COLMENA OCUPADA A TU CASA OCUPADA',
							'title'      => 'MIEL HONESTA DEL CORAZÓN DEL CAMPO',
							'titleTag'   => 'h2',
							'text'       => '<p>Trabajamos con apicultores seleccionados uno a uno y con nuestros propios colmenares. Cada lote se analiza y se puede rastrear hasta su origen.</p>',
							'linkText'   => 'CONOCE MÁS',
							'linkUrl'    => '/nosotros/',
							'imageId'    => 0,
							'imageSide'  => 'left',
							'imageShape' => 'arch',
							'ratio'      => 'balanced',
							'theme'      => 'cream',
							'tracking'   => 'wide',
							'align'      => 'left',
						]
					),
				]
			),
			self::reviews(),
			self::bleed(
				'Distribución',
				[
					self::node(
						'retail-strip',
						[
							'title'     => 'DISPONIBLE EN TUS TIENDAS HABITUALES',
							'titleTag'  => 'h2',
							'tracking'  => 'wide',
							'grayscale' => true,
							'theme'     => 'cream',
							'items'     => [
								[ 'title' => 'DISTRIBUIDOR 1', 'imageId' => 0, 'alt' => '', 'url' => '' ],
								[ 'title' => 'DISTRIBUIDOR 2', 'imageId' => 0, 'alt' => '', 'url' => '' ],
								[ 'title' => 'DISTRIBUIDOR 3', 'imageId' => 0, 'alt' => '', 'url' => '' ],
							],
						]
					),
				]
			),
			self::store_cta(),
			self::wordmark_block(),
		];
	}

	public static function products(): array {
		return [
			self::bleed(
				'Hero',
				[
					self::node(
						'brand-hero',
						[
							'variant'    => 'center',
							'eyebrow'    => '',
							'title'      => 'RASTREA SU DULCE VIAJE HASTA TI',
							'subtitle'   => 'MIEL CRUDA, UN SOLO INGREDIENTE.',
							'subtitle2'  => '',
							'text'       => '',
							'buttons'    => [],
							'imageId'    => 0,
							'overlay'    => 25,
							'height'     => 'medium',
							'theme'      => 'cream',
							'scrollHint' => false,
						]
					),
				]
			),
			self::strip( 'UN SOLO INGREDIENTE', 'solid', 'md' ),
			self::bleed(
				'Más vendidos',
				[
					self::node(
						'product-rail',
						[
							'eyebrow'   => 'DE NUESTRA FAMILIA A LA TUYA',
							'title'     => 'NUESTROS MÁS VENDIDOS',
							'titleTag'  => 'h2',
							'tracking'  => 'normal',
							'align'     => 'center',
							'linkText'  => '',
							'linkUrl'   => '',
							'desktop'   => 3,
							'tablet'    => 2,
							'mobile'    => 1,
							'layout'    => 'grid',
							'cardStyle' => 'soft',
							'arrows'    => false,
							'theme'     => 'cream',
							'items'     => [
								[ 'title' => 'FORMATO 340 G', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'title' => 'FORMATO 450 G', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'title' => 'MONODOSIS (20 UD.)', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'title' => 'FORMATO 680 G', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'title' => 'FORMATO 900 G', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'title' => 'CREMA 340 G', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
							],
						]
					),
				]
			),
			self::bleed(
				'Miel local',
				[
					self::node(
						'collection-grid',
						[
							'eyebrow'   => 'MIEL LOCAL',
							'title'     => 'HECHA POR ABEJAS CERCA DE TI',
							'titleTag'  => 'h2',
							'tracking'  => 'normal',
							'align'     => 'center',
							'linkText'  => '',
							'linkUrl'   => '',
							'desktop'   => 4,
							'tablet'    => 2,
							'mobile'    => 1,
							'cardStyle' => 'stacked',
							'ratio'     => 'square',
							'theme'     => 'surface',
							'items'     => [
								[ 'category' => 'NORTE', 'title' => 'MIEL DEL NORTE', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'LEVANTE', 'title' => 'MIEL DE LEVANTE', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'SUR', 'title' => 'MIEL DEL SUR', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'MESETA', 'title' => 'MIEL DE MESETA', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'ISLAS', 'title' => 'MIEL DE ISLAS', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'PIRINEOS', 'title' => 'MIEL DE MONTAÑA', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'ATLÁNTICO', 'title' => 'MIEL ATLÁNTICA', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'INTERIOR', 'title' => 'MIEL DE INTERIOR', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
							],
						]
					),
				]
			),
			self::product_panel(),
			self::reviews(),
			self::store_cta(),
			self::wordmark_block(),
		];
	}

	public static function about(): array {
		return [
			self::bleed(
				'Hero',
				[
					self::node(
						'brand-hero',
						[
							'variant'    => 'center',
							'eyebrow'    => 'MÁS QUE UNA EMPRESA DE MIEL',
							'title'      => 'BIENVENIDO A LA CASA DE LA MIEL',
							'subtitle'   => 'UNA FAMILIA QUE QUIERE A LAS ABEJAS.',
							'subtitle2'  => '',
							'text'       => '',
							'buttons'    => [],
							'imageId'    => 0,
							'overlay'    => 30,
							'height'     => 'tall',
							'theme'      => 'cream',
							'scrollHint' => true,
						]
					),
				]
			),
			self::bleed(
				'Origen',
				[
					self::node(
						'split-feature',
						[
							'eyebrow'    => 'TODO EMPEZÓ HACE UN SIGLO',
							'title'      => 'CIEN AÑOS APRENDIENDO DE LAS ABEJAS',
							'titleTag'   => 'h2',
							'text'       => '<p>Nuestras raíces apícolas vienen de muy atrás: un bisabuelo que aprendió el oficio en los colmenares y compró sus primeras treinta colmenas. Seguimos trabajando con apicultores de confianza y con nuestros propios colmenares, con estándares altos de seguridad, calidad, pureza y trazabilidad real.</p>',
							'linkText'   => '',
							'linkUrl'    => '',
							'imageId'    => 0,
							'imageSide'  => 'right',
							'imageShape' => 'rounded',
							'ratio'      => 'balanced',
							'theme'      => 'cream',
							'tracking'   => 'wide',
							'align'      => 'left',
						]
					),
				]
			),
			self::bleed(
				'Misión',
				[
					self::node(
						'display-type',
						[
							'eyebrow'   => 'NUESTRA MISIÓN',
							'text'      => 'CUIDAR A LAS ABEJAS, POR ELLAS Y POR NOSOTROS',
							'tag'       => 'h2',
							'size'      => 'xl',
							'tracking'  => 'wide',
							'align'     => 'center',
							'reveal'    => 'letters',
							'colorMode' => 'inherit',
							'maxWidth'  => 1100,
						]
					),
				]
			),
			self::bleed(
				'Prácticas',
				[
					self::node(
						'numbered-list',
						[
							'eyebrow'     => 'LIDERANDO EL SECTOR',
							'title'       => 'ESTÁNDARES ALTOS. PRÁCTICAS CUIDADOSAS.',
							'titleTag'    => 'h2',
							'tracking'    => 'wide',
							'align'       => 'left',
							'variant'     => 'stack',
							'numberStyle' => 'pad',
							'startAt'     => 1,
							'openFirst'   => true,
							'desktop'     => 2,
							'tablet'      => 1,
							'mobile'      => 1,
							'theme'       => 'surface',
							'items'       => [
								[ 'title' => 'COLMENAS CUIDADAS', 'text' => 'Las abejas a nuestro cargo se tratan con delicadeza y respeto.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'HECHA DE FORMA NATURAL', 'text' => 'La miel la hacen las abejas con el néctar que recogen. Nada más.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'SALUD DE LA COLMENA', 'text' => 'Cuando hace falta tratar plagas o enfermedades, empezamos siempre por prácticas naturales y ecológicas.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'CALIDAD TRANSPARENTE', 'text' => 'Cada lote pasa controles de seguridad alimentaria y de transparencia en la cadena de suministro.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'INVESTIGACIÓN', 'text' => 'Financiamos investigación y proyectos de salud de las abejas junto a universidades y centros especializados.', 'imageId' => 0, 'alt' => '' ],
							],
						]
					),
				]
			),
			self::bleed(
				'Nuestra forma de trabajar',
				[
					self::node(
						'split-feature',
						[
							'eyebrow'    => 'CÓMO TRABAJAMOS',
							'title'      => 'NUESTRA FORMA DE HACER LAS COSAS',
							'titleTag'   => 'h2',
							'text'       => '<p>Respetamos a las abejas y las tratamos bien, reconociendo todo lo que tenemos en común. Como ellas, cuidamos de los nuestros, trabajamos duro, perseveramos y celebramos los éxitos dulces.</p>',
							'linkText'   => '',
							'linkUrl'    => '',
							'imageId'    => 0,
							'imageSide'  => 'left',
							'imageShape' => 'arch',
							'ratio'      => 'image-wide',
							'theme'      => 'cream',
							'tracking'   => 'wide',
							'align'      => 'left',
						]
					),
				]
			),
			self::bleed(
				'Hitos',
				[
					self::node(
						'statement-list',
						[
							'eyebrow'  => 'INNOVAMOS',
							'title'    => 'NUESTROS PRIMEROS PASOS',
							'titleTag' => 'h2',
							'tracking' => 'normal',
							'align'    => 'left',
							'theme'    => 'cream',
							'items'    => [
								[ 'label' => 'ANÁLISIS CONSTANTE', 'title' => 'LOS PRIMEROS EN MONTAR UN LABORATORIO PROPIO PARA ANALIZAR CADA LOTE', 'url' => '' ],
								[ 'label' => 'TRANSPARENCIA', 'title' => 'LOS PRIMEROS EN OFRECER TRAZABILIDAD REAL: FLOR, COLMENA, COSECHA Y CONSUMIDOR', 'url' => '' ],
								[ 'label' => 'CADENA DE SUMINISTRO', 'title' => 'LOS PRIMEROS EN CERTIFICAR EL ORIGEN Y LA CADENA DE SUMINISTRO', 'url' => '' ],
								[ 'label' => 'SEGURIDAD Y CALIDAD', 'title' => 'LOS PRIMEROS EN ADOPTAR LA CERTIFICACIÓN DE SEGURIDAD ALIMENTARIA DEL SECTOR', 'url' => '' ],
							],
						]
					),
				]
			),
			self::bestsellers(),
		];
	}

	public static function kitchen(): array {
		return [
			self::bleed(
				'Hero',
				[
					self::node(
						'brand-hero',
						[
							'variant'    => 'center',
							'eyebrow'    => 'EN LA COCINA',
							'title'      => 'RECETAS PARA INSPIRARTE',
							'subtitle'   => '',
							'subtitle2'  => '',
							'text'       => '',
							'buttons'    => [],
							'imageId'    => 0,
							'overlay'    => 30,
							'height'     => 'medium',
							'theme'      => 'cream',
							'scrollHint' => false,
						]
					),
				]
			),
			self::bleed(
				'Destacadas',
				[
					self::node(
						'collection-grid',
						[
							'eyebrow'   => '',
							'title'     => 'NUESTRAS FAVORITAS',
							'titleTag'  => 'h2',
							'tracking'  => 'normal',
							'align'     => 'center',
							'linkText'  => '',
							'linkUrl'   => '',
							'desktop'   => 3,
							'tablet'    => 2,
							'mobile'    => 1,
							'cardStyle' => 'overlay',
							'ratio'     => 'portrait',
							'theme'     => 'cream',
							'items'     => [
								[ 'category' => 'POSTRES', 'title' => 'POLOS DE FRESA Y MIEL', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => '', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'ENSALADAS', 'title' => 'ENSALADA DE BRÓCOLI', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => '', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'BEBIDAS', 'title' => 'LIMONADA CON MIEL', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => '', 'url' => '#', 'badge' => '' ],
							],
						]
					),
				]
			),
			self::bleed(
				'Trucos',
				[
					self::node(
						'display-type',
						[
							'eyebrow'   => '',
							'text'      => 'TRUCOS DE REPOSTERÍA',
							'tag'       => 'h2',
							'size'      => 'display',
							'tracking'  => 'wider',
							'align'     => 'center',
							'reveal'    => 'letters',
							'colorMode' => 'primary',
							'maxWidth'  => 0,
						]
					),
					self::node(
						'scroll-text',
						[
							'text'     => '¿Sabías que la miel puede endulzar dos o tres veces más que el azúcar? Aquí van unos trucos para que te salga bien a la primera.',
							'size'     => 'lg',
							'align'    => 'center',
							'maxWidth' => 900,
							'theme'    => 'cream',
						]
					),
				]
			),
			self::bleed(
				'Guía',
				[
					self::node(
						'numbered-list',
						[
							'eyebrow'     => '',
							'title'       => '',
							'titleTag'    => 'h2',
							'tracking'    => 'wide',
							'align'       => 'left',
							'variant'     => 'stack',
							'numberStyle' => 'pad',
							'startAt'     => 1,
							'openFirst'   => false,
							'desktop'     => 2,
							'tablet'      => 1,
							'mobile'      => 1,
							'theme'       => 'surface',
							'items'       => [
								[ 'title' => 'CÓMO MEDIRLA', 'text' => 'Engrasa ligeramente el vaso medidor o caliéntalo con agua: la miel se despega sola y la medida es exacta. La miel se vende por peso, no por volumen.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'EQUIVALENCIAS', 'text' => 'Como se vende por peso y las recetas suelen pedir volumen, siempre necesitas un poco más de lo que crees.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'AL HORNEAR', 'text' => 'Hasta una taza puedes sustituir azúcar por miel a partes iguales. Por encima, usa entre 2/3 y 3/4 de taza de miel por cada taza de azúcar, baja el horno unos grados y reduce el resto de líquidos.', 'imageId' => 0, 'alt' => '' ],
							],
						]
					),
				]
			),
			self::section(
				'Tabla de equivalencias',
				[
					self::node(
						'info-table',
						[
							'title'   => 'EQUIVALENCIAS DE PESO A VOLUMEN',
							'headA'   => 'Peso',
							'headB'   => 'Volumen aproximado',
							'caption' => 'Tabla orientativa para recetas de repostería.',
							'theme'   => 'surface',
							'rows'    => [
								[ 'a' => '225 g', 'b' => '2/3 de taza' ],
								[ 'a' => '340 g', 'b' => '1 taza' ],
								[ 'a' => '450 g', 'b' => '1 taza y 1/3' ],
								[ 'a' => '680 g', 'b' => '2 tazas' ],
								[ 'a' => '900 g', 'b' => '2 tazas y 2/3' ],
								[ 'a' => '1,4 kg', 'b' => '4 tazas' ],
							],
						]
					),
				]
			),
			self::bleed(
				'Recetario',
				[
					self::node(
						'filter-collection',
						[
							'title'       => 'ENCUENTRA LA RECETA PERFECTA',
							'titleTag'    => 'h2',
							'text'        => 'Explora el recetario y encuentra un plato o una bebida que convenza hasta al paladar más exigente.',
							'align'       => 'center',
							'desktop'     => 4,
							'tablet'      => 2,
							'mobile'      => 1,
							'perPage'     => 8,
							'showSearch'  => true,
							'showFilters' => true,
							'allLabel'    => 'Todo',
							'moreLabel'   => 'CARGAR MÁS',
							'emptyLabel'  => 'No hay recetas que coincidan con ese filtro.',
							'theme'       => 'cream',
							'items'       => [
								[ 'category' => 'Carnes', 'title' => 'LOMO GLASEADO CON MIEL Y CEBOLLA', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Bebidas', 'title' => 'LASSI DE MANGO Y JENGIBRE', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Entrantes', 'title' => 'BRIE AL HORNO CON MIEL', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Postres', 'title' => 'TARTA DE CALABAZA', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Sopas', 'title' => 'CREMA DE TOMATE', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Bebidas', 'title' => 'PONCHE DE SIDRA', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Sopas', 'title' => 'CREMA DE CALABAZA', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Bebidas', 'title' => 'LIMONADA CON MIEL', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Postres', 'title' => 'BUÑUELOS DE MIEL', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Bebidas', 'title' => 'PONCHE DE VERANO', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Ensaladas', 'title' => 'ENSALADA DE BRÓCOLI', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Postres', 'title' => 'POLOS DE FRESA Y MIEL', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
							],
						]
					),
				]
			),
			self::bleed(
				'Maridajes',
				[
					self::node(
						'numbered-list',
						[
							'eyebrow'     => '',
							'title'       => 'MARIDAJES CON MIEL',
							'titleTag'    => 'h2',
							'tracking'    => 'wide',
							'align'       => 'center',
							'variant'     => 'grid',
							'numberStyle' => 'pad',
							'startAt'     => 1,
							'openFirst'   => false,
							'desktop'     => 3,
							'tablet'      => 2,
							'mobile'      => 1,
							'theme'       => 'cream',
							'items'       => [
								[ 'title' => 'HIERBAS Y ESPECIAS', 'text' => 'Infusiona la miel con hierbas y especias. Va bien en salsas, guisos, marinadas, glaseados, aliños y masa de pizza.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'FRUTA Y FRUTOS SECOS', 'text' => 'Perfecta en parfaits, sobre tortitas y ensaladas, en batidos, pincelada sobre fruta antes de asarla o glaseando frutos secos.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'LÁCTEOS', 'text' => 'Endulza leche y bebidas vegetales, helados, cereales, cafés e infusiones. Y acompaña de maravilla a los quesos.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'AVES', 'text' => 'Da un punto dulce y fresco a salsas barbacoa, marinadas y glaseados. Pincela pollo, pato o pavo para una piel crujiente.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'CARNES', 'text' => 'Añádela a marinadas, salsas, guisos y glaseados. Pincela costillas o asados al final de la cocción.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'BEBIDAS', 'text' => 'Aporta dulzor natural a tés fríos, cafés, zumos y batidos. Deliciosa en infusiones y en chocolate caliente.', 'imageId' => 0, 'alt' => '' ],
							],
						]
					),
				]
			),
			self::bestsellers(),
		];
	}

	public static function faq(): array {
		return [
			self::bleed(
				'Hero',
				[
					self::node(
						'brand-hero',
						[
							'variant'    => 'center',
							'eyebrow'    => 'RESUELVE TUS DUDAS',
							'title'      => 'PREGUNTAS FRECUENTES',
							'subtitle'   => '',
							'subtitle2'  => '',
							'text'       => '',
							'buttons'    => [],
							'imageId'    => 0,
							'overlay'    => 25,
							'height'     => 'short',
							'theme'      => 'cream',
							'scrollHint' => false,
						]
					),
				]
			),
			self::bleed(
				'Preguntas',
				[
					self::node(
						'numbered-list',
						[
							'eyebrow'     => '',
							'title'       => '',
							'titleTag'    => 'h2',
							'tracking'    => 'wide',
							'align'       => 'left',
							'variant'     => 'accordion',
							'numberStyle' => 'pad',
							'startAt'     => 1,
							'openFirst'   => true,
							'desktop'     => 1,
							'tablet'      => 1,
							'mobile'      => 1,
							'theme'       => 'cream',
							'items'       => [
								[ 'title' => '¿QUÉ ES LA MIEL?', 'text' => 'Es una sustancia dulce y espesa que producen las abejas a partir del néctar de las flores. Añaden enzimas y eliminan agua hasta convertirlo en miel: azúcares naturales, agua, minerales, vitaminas y enzimas.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿QUÉ ES LA MIEL CRUDA?', 'text' => 'Es la miel tal y como está en la colmena o con un procesado mínimo: se atempera suavemente y se cuela, no se filtra, para conservar polen, enzimas y nutrientes.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿QUÉ LLEVA DENTRO?', 'text' => 'Miel cruda, y nada más. Sin añadidos y sin quitar nada. Cada lote se analiza en seguridad, calidad y pureza.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿DÓNDE ESTÁIS?', 'text' => 'Tenemos sede y centros repartidos para acortar los kilómetros entre donde se hace la miel, se cosecha y se envasa.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿CÓMO LA CONSEGUÍS?', 'text' => 'Trabajamos con apicultores de confianza, seleccionados uno a uno, y también con nuestros propios colmenares.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿QUÉ SIGNIFICA TRAZABLE?', 'text' => 'Que puedes seguir el recorrido de tu bote desde la flor hasta el envase: dónde estaban las colmenas, qué flores visitaron las abejas y dónde se extrajo y envasó.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿ESTÁ MEZCLADA?', 'text' => 'No se mezcla nunca con miel de otros orígenes. Un solo ingrediente: miel cruda.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿CÓMO SABÉIS QUÉ FLORES VISITARON?', 'text' => 'Mediante análisis de laboratorio independiente de los pólenes presentes en la miel.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿CÓMO LA GUARDO? ¿CADUCA?', 'text' => 'A temperatura ambiente y sin luz directa. No necesita nevera. Bien cerrada, la miel cruda no caduca.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿POR QUÉ HA CAMBIADO DE TEXTURA?', 'text' => 'Es natural: la miel cruda cristaliza con el tiempo y sigue siendo segura. Si la prefieres líquida, pon el bote en agua templada hasta que se deshagan los cristales.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿PUEDEN TOMARLA BEBÉS O PERSONAS ALÉRGICAS?', 'text' => 'Nunca debe darse miel a menores de un año. Para el resto es segura salvo alergia conocida a la miel o a productos de la abeja.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿CUÁL ES SU INFORMACIÓN NUTRICIONAL?', 'text' => 'Por ración de una cucharada (21 g): 60 kcal, 0 g de grasa, 0 mg de sodio, 17 g de hidratos, 17 g de azúcares y 0 g de proteína.', 'imageId' => 0, 'alt' => '' ],
							],
						]
					),
				]
			),
			self::store_cta(),
		];
	}

	public static function contact(): array {
		return [
			self::bleed(
				'Hero',
				[
					self::node(
						'brand-hero',
						[
							'variant'    => 'center',
							'eyebrow'    => 'CONTACTO',
							'title'      => '¿PREGUNTAS? ¿COMENTARIOS?',
							'subtitle'   => '',
							'subtitle2'  => '',
							'text'       => 'Escríbenos con el formulario y cuéntanos qué tienes en mente. Te leemos.',
							'buttons'    => [ self::btn( '¿MÁS INFORMACIÓN?', '/faq/', 'outline' ) ],
							'imageId'    => 0,
							'overlay'    => 25,
							'height'     => 'short',
							'theme'      => 'cream',
							'scrollHint' => false,
						]
					),
				]
			),
			self::section(
				'Formulario',
				[
					self::node(
						'contact-form',
						[
							'submit'      => 'ENVIAR',
							'success'     => 'Mensaje enviado. Gracias.',
							'showPhone'   => false,
							'showSubject' => false,
							'showMessage' => true,
							'style'       => 'underline',
							'optIns'      => [
								[ 'label' => 'Quiero seguir el viaje de mi miel', 'required' => false ],
								[ 'label' => 'Apúntame a la newsletter', 'required' => false ],
							],
							'consent'     => 'Al enviar este formulario aceptas recibir comunicaciones por correo electrónico. Puedes darte de baja en cualquier momento desde el enlace que aparece al final de cada email.',
						]
					),
				]
			),
			self::strip( 'TE LEEMOS', 'solid', 'md' ),
		];
	}

	/* ------------------------------------------------------------------ */
	/* Plantillas para la biblioteca del constructor                       */
	/* ------------------------------------------------------------------ */

	/**
	 * Busca la primera sección de un documento que contenga un componente del
	 * tipo indicado. Evita depender de índices numéricos, que se rompen en
	 * cuanto se reordena una página.
	 *
	 * @param array  $sections Secciones del documento.
	 * @param string $type     Slug del componente buscado.
	 */
	private static function pick( array $sections, string $type ): ?array {
		foreach ( $sections as $section ) {
			foreach ( $section['children'] ?? [] as $child ) {
				if ( ( $child['type'] ?? '' ) === $type ) {
					return $section;
				}
			}
		}
		return null;
	}

	public static function library_items(): array {
		$home    = self::home();
		$about   = self::about();
		$kitchen = self::kitchen();
		$faq     = self::faq();

		$wanted = [
			[ __( 'Hero de marca', 'meridian' ), self::pick( $home, 'brand-hero' ) ],
			[ __( 'Marquesina', 'meridian' ), self::strip( 'TEXTO EN BUCLE', 'solid', 'md' ) ],
			[ __( 'Panel partido a pantalla completa', 'meridian' ), self::split_hero() ],
			[ __( 'Panel de producto con carrusel', 'meridian' ), self::product_panel() ],
			[ __( 'Módulo de trazabilidad', 'meridian' ), self::pick( $home, 'trace-module' ) ],
			[ __( 'Carril de productos', 'meridian' ), self::bestsellers() ],
			[ __( 'Bloque partido', 'meridian' ), self::pick( $home, 'split-feature' ) ],
			[ __( 'Carrusel de reseñas', 'meridian' ), self::reviews() ],
			[ __( 'Banda de distribuidores', 'meridian' ), self::pick( $home, 'retail-strip' ) ],
			[ __( 'CTA display', 'meridian' ), self::store_cta() ],
			[ __( 'Lista numerada (acordeón)', 'meridian' ), self::pick( $faq, 'numbered-list' ) ],
			[ __( 'Lista de hitos', 'meridian' ), self::pick( $about, 'statement-list' ) ],
			[ __( 'Colección filtrable', 'meridian' ), self::pick( $kitchen, 'filter-collection' ) ],
			[ __( 'Tabla de datos', 'meridian' ), self::pick( $kitchen, 'info-table' ) ],
			[ __( 'Logotipo tipográfico', 'meridian' ), self::wordmark_block() ],
		];

		$out = [];
		foreach ( $wanted as [ $name, $node ] ) {
			if ( is_array( $node ) ) {
				$out[] = [ 'name' => $name, 'node' => $node ];
			}
		}
		return $out;
	}

	/* ------------------------------------------------------------------ */
	/* Header / footer alineados con el sistema visual                     */
	/* ------------------------------------------------------------------ */

	public static function apply_chrome(): void {
		$header = array_merge(
			\Meridian\Navigation\Menus::default_header(),
			[
				'sticky'         => true,
				'ctaText'        => 'ENCONTRAR TIENDA',
				'ctaUrl'         => '/contacto/',
				'height'         => 84,
				'paddingY'       => 18,
				'align'          => 'left',
				'distribute'     => 'x',
				'background'     => 'var(--color-background)',
				'color'          => 'var(--color-text)',
				'navHoverFg'     => 'var(--color-primary)',
				'navModeDesktop' => 'bar',
				'navModeTablet'  => 'drawer',
				'navModeMobile'  => 'drawer',
			]
		);
		\Meridian\Navigation\Menus::save_header( $header );

		$footer = array_merge(
			\Meridian\Navigation\Menus::default_footer(),
			[
				'text'           => 'Miel honesta, trazable de la flor al bote.',
				'copyright'      => '© ' . gmdate( 'Y' ) . ' ' . get_bloginfo( 'name' ),
				'copyrightAlign' => 'center',
				'columns'        => 3,
				'paddingY'       => 84,
				'background'     => 'var(--color-primary)',
				'color'          => 'var(--color-on-primary, #fff)',
				'headingColor'   => 'var(--color-on-primary, #fff)',
				'linkColor'      => 'var(--color-on-primary, #fff)',
				'linkHoverFg'    => 'var(--color-background)',
				'showSearch'     => false,
				'extraTitle'     => 'TRAZABILIDAD',
				'extraText'      => 'Introduce el código de tu bote y sigue su recorrido completo.',
			]
		);
		\Meridian\Navigation\Menus::save_footer( $footer );
	}
}

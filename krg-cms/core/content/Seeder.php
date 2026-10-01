<?php
/**
 * Initial content.
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

class Seeder {

	public static function run(): void {
		if ( get_option( 'meridian_seeded' ) ) {
			return;
		}
		// El contenido de arranque vive en una capa opcional.
		if ( ! class_exists( ReferenceSeeder::class ) ) {
			return;
		}

		$pages = self::reference_pages();
		$ids   = [];
		foreach ( $pages as $slug => $page ) {
			$ids[ $slug ] = self::page( $page['title'], $slug, $page['sections'] );
		}

		$blog = self::page( __( 'Blog', 'meridian' ), 'blog', self::blog_doc() );

		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $ids['inicio'] );
		update_option( 'page_for_posts', $blog );

		self::sample_posts();

		update_option( 'meridian_seeded', 1 );
		delete_option( MERIDIAN_OPTION_MENUS );
		self::build_menus( $ids, $blog );
		ReferenceSeeder::apply_chrome();
	}

	/**
	 * Páginas iniciales construidas con la librería de componentes derivada de
	 * las referencias. Son contenido editable, no plantillas cerradas.
	 *
	 * @return array<string, array{title:string, sections:array}>
	 */
	private static function reference_pages(): array {
		return [
			'inicio'    => [ 'title' => __( 'Inicio', 'meridian' ), 'sections' => ReferenceSeeder::home() ],
			'productos' => [ 'title' => __( 'Productos', 'meridian' ), 'sections' => ReferenceSeeder::products() ],
			'nosotros'  => [ 'title' => __( 'Nosotros', 'meridian' ), 'sections' => ReferenceSeeder::about() ],
			'cocina'    => [ 'title' => __( 'Cocina', 'meridian' ), 'sections' => ReferenceSeeder::kitchen() ],
			'faq'       => [ 'title' => __( 'Preguntas frecuentes', 'meridian' ), 'sections' => ReferenceSeeder::faq() ],
			'contacto'  => [ 'title' => __( 'Contacto', 'meridian' ), 'sections' => ReferenceSeeder::contact() ],
		];
	}

	/**
	 * Menús de header y footer con el orden de navegación de la referencia.
	 *
	 * @param array<string, int> $ids  Slug => post ID.
	 * @param int                $blog Página de blog.
	 */
	private static function build_menus( array $ids, int $blog ): void {
		$item = static function ( string $label, int $page_id ): array {
			return [
				'id'       => 'itm_' . $page_id,
				'label'    => $label,
				'type'     => 'internal',
				'pageId'   => $page_id,
				'url'      => '',
				'target'   => '_self',
				'visible'  => true,
				'children' => [],
			];
		};

		$primary = [];
		foreach (
			[
				'productos' => __( 'Productos', 'meridian' ),
				'nosotros'  => __( 'Nosotros', 'meridian' ),
				'cocina'    => __( 'Cocina', 'meridian' ),
				'faq'       => __( 'FAQ', 'meridian' ),
				'contacto'  => __( 'Contacto', 'meridian' ),
			] as $slug => $label
		) {
			if ( ! empty( $ids[ $slug ] ) ) {
				$primary[] = $item( $label, (int) $ids[ $slug ] );
			}
		}

		$secondary = $primary;
		if ( $blog ) {
			$secondary[] = $item( __( 'Blog', 'meridian' ), $blog );
		}

		\Meridian\Navigation\Menus::save(
			[
				[ 'slug' => 'header', 'name' => __( 'Header', 'meridian' ), 'items' => $primary ],
				[ 'slug' => 'footer', 'name' => __( 'Footer', 'meridian' ), 'items' => $secondary ],
				[ 'slug' => 'secondary', 'name' => __( 'Secundario', 'meridian' ), 'items' => [] ],
			]
		);
	}

	private static function page( string $title, string $slug, array $sections ): int {
		$existing = get_page_by_path( $slug );
		if ( $existing ) {
			$id = $existing->ID;
		} else {
			$id = wp_insert_post(
				[
					'post_type'   => 'page',
					'post_status' => 'publish',
					'post_title'  => $title,
					'post_name'   => $slug,
				]
			);
		}
		$doc            = Document::empty( (int) $id, $title, $slug );
		$doc['status']  = 'publish';
		$doc['sections']= $sections;
		$doc            = \Meridian\Security\Sanitizer::document( $doc );
		PageRepository::write_meta( (int) $id, MERIDIAN_META_DRAFT, $doc );
		PageRepository::write_meta( (int) $id, MERIDIAN_META_PUBLISHED, $doc );
		update_post_meta( $id, MERIDIAN_META_ENABLED, '1' );
		$html = \Meridian\Render\PageRenderer::html_from_document( $doc, false, (int) $id );
		wp_update_post( [ 'ID' => $id, 'post_status' => 'publish', 'post_content' => $html ] );
		return (int) $id;
	}

	private static function nid( string $p = 'n' ): string {
		return $p . '_' . wp_generate_uuid4();
	}

	private static function node( string $type, array $props = [], array $children = [], array $extra = [] ): array {
		return array_merge(
			[
				'id'       => self::nid( $type === 'section' ? 'sec' : 'cmp' ),
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

	private static function section( string $name, array $children, array $props = [] ): array {
		return self::node( 'section', array_merge( [ 'name' => $name ], $props ), $children, [ 'name' => $name ] );
	}

	private static function blog_doc(): array {
		return [
			self::section(
				'Intro',
				[
					self::node( 'eyebrow', [ 'text' => 'Bitácora' ] ),
					self::node( 'heading', [ 'text' => 'Notas y artículos', 'tag' => 'h1' ] ),
					self::node( 'paragraph', [ 'text' => 'Las entradas se editan en el módulo Blog, independiente del constructor.' ] ),
				]
			),
			self::section(
				'Grid',
				[
					self::node( 'blog-grid', [ 'count' => 6, 'desktop' => 3 ] ),
				]
			),
		];
	}

	private static function sample_posts(): void {
		if ( wp_count_posts( 'post' )->publish > 1 ) {
			return;
		}
		$cat = wp_insert_term( 'Plataforma', 'category' );
		$cid = is_wp_error( $cat ) ? 1 : $cat['term_id'];
		$posts = [
			[ 'Cómo se construye una página en KRG CMS', '<p>Abre Páginas, crea una nueva, agrega una sección Hero y publica. El permalink aparece solo.</p>' ],
			[ 'Tokens, no hexadecimales sueltos', '<p>El color primario es un token. Los componentes usan var(--color-primary). Cambiarlo actualiza el sitio entero.</p>' ],
			[ 'Blog y constructor no son el mismo motor', '<p>Las páginas son un árbol JSON. Las entradas de blog son HTML semántico. Cada uno hace mejor su trabajo.</p>' ],
		];
		foreach ( $posts as $i => $p ) {
			$id = wp_insert_post(
				[
					'post_type'    => 'post',
					'post_status'  => 'publish',
					'post_title'   => $p[0],
					'post_content' => $p[1],
					'post_excerpt' => wp_trim_words( wp_strip_all_tags( $p[1] ), 20 ),
				]
			);
			wp_set_post_categories( $id, [ $cid ] );
		}
	}

	public static function maybe_library(): void {
		if ( get_option( 'meridian_templates_seeded' ) ) {
			return;
		}
		if ( ! post_type_exists( 'meridian_template' ) || ! class_exists( ReferenceSeeder::class ) ) {
			return;
		}
		foreach ( ReferenceSeeder::library_items() as $item ) {
			GlobalsRepository::save( 'meridian_template', $item );
		}
		update_option( 'meridian_templates_seeded', 1 );
	}

	public static function maybe_users(): void {
		$users = [
			[ 'autor', 'autor123', 'autor@meridian.test', 'author' ],
			[ 'editor', 'editor123', 'editor@meridian.test', 'editor' ],
		];
		foreach ( $users as [ $login, $pass, $email, $role ] ) {
			if ( username_exists( $login ) ) {
				continue;
			}
			$id = wp_create_user( $login, $pass, $email );
			if ( is_wp_error( $id ) ) {
				continue;
			}
			$user = new \WP_User( $id );
			$user->set_role( $role );
		}
	}
}

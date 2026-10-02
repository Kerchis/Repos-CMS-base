<?php
/**
 * Page renderer.
 *
 * @package Meridian
 */

namespace Meridian\Render;

defined( 'ABSPATH' ) || exit;

class PageRenderer {

	private static array $needed = [];
	private static ?array $current_document = null;

	public static function post_has_document( int $post_id ): bool {
		return (bool) get_post_meta( $post_id, MERIDIAN_META_ENABLED, true );
	}

	public static function current_document(): ?array {
		return self::$current_document;
	}

	public static function prime( int $post_id ): void {
		$preview = Preview::is_preview();
		$state   = $preview ? 'draft' : 'published';
		$doc     = \Meridian\Content\PageRepository::get( $post_id, $state );
		if ( ! $doc && ! $preview ) {
			$doc = \Meridian\Content\PageRepository::get( $post_id, 'draft' );
		}
		if ( $doc ) {
			self::$current_document = $doc;
		}
	}

	public static function needed_assets(): array {
		return self::$needed;
	}

	public static function for_post( int $post_id ): string {
		$preview = Preview::is_preview();
		$doc     = self::$current_document;
		if ( ! $doc || (int) ( $doc['id'] ?? 0 ) !== $post_id ) {
			$state = $preview ? 'draft' : 'published';
			$doc   = \Meridian\Content\PageRepository::get( $post_id, $state );
			if ( ! $doc && ! $preview ) {
				$doc = \Meridian\Content\PageRepository::get( $post_id, 'draft' );
			}
		}
		if ( ! $doc ) {
			return '';
		}
		self::$current_document = $doc;

		if ( ! $preview ) {
			$sum  = (string) ( $doc['checksum'] ?? '' );
			$html = \Meridian\Cache\DocumentCache::html( $post_id, $sum );
			if ( is_string( $html ) ) {
				return $html;
			}
		}

		$html = self::html_from_document( $doc, $preview, $post_id );
		if ( ! $preview ) {
			$css = \Meridian\Style\DocumentCssCompiler::compile( $doc );
			\Meridian\Cache\DocumentCache::put( $post_id, (string) ( $doc['checksum'] ?? '' ), $html, $css );
		}
		return $html;
	}

	public static function html_from_document( array $doc, bool $preview, ?int $post_id = null ): string {
		$ctx            = new RenderContext();
		$ctx->isPreview = $preview;
		$ctx->isCanvas  = $preview && Preview::is_canvas();
		$ctx->postId    = $post_id;
		$ctx->document  = $doc;
		$ids            = NodeRenderer::collect_global_ids( $doc['sections'] ?? [] );
		$ctx->globals   = \Meridian\Content\GlobalsRepository::map_by_ids( $ids );

		$media = \Meridian\Media\Prefetch::collect_from_document( $doc );
		foreach ( $ctx->globals as $g ) {
			if ( is_array( $g ) ) {
				\Meridian\Media\Prefetch::walk( [ $g ], $media );
			}
		}
		\Meridian\Media\Prefetch::prime( $media );

		$html = '';
		foreach ( $doc['sections'] ?? [] as $section ) {
			if ( array_key_exists( 'visible', $section ) && ! $section['visible'] && ! $preview ) {
				continue;
			}
			$html .= NodeRenderer::render( $section, $ctx );
		}
		self::$needed = $ctx->needed;
		return $html;
	}
}

module.exports = {
  'apostrophe-multisite': '@apostrophecms-pro/multisite',
  'apostrophe-utils': '@apostrophecms/util',
  'apostrophe-tasks': '@apostrophecms/task',
  'apostrophe-launder': '@apostrophecms/launder',
  'apostrophe-i18n': '@apostrophecms/i18n',
  'apostrophe-db': '@apostrophecms/db',
  'apostrophe-locks': '@apostrophecms/lock',
  // TODO linter: we have to point out that the
  // cache API has also changed, in ways we probably
  // can't automatically rewrite
  'apostrophe-caches': '@apostrophecms/cache',
  'apostrophe-migrations': '@apostrophecms/migration',
  'apostrophe-express': '@apostrophecms/express',
  'apostrophe-urls': '@apostrophecms/url',
  'apostrophe-templates': '@apostrophecms/template',
  'apostrophe-email': '@apostrophecms/email',
  'apostrophe-push': '@apostrophecms/push',
  'apostrophe-permissions': '@apostrophecms/permission',
  'apostrophe-assets': '@apostrophecms/asset',
  'apostrophe-admin-bar': '@apostrophecms/admin-bar',
  'apostrophe-login': '@apostrophecms/login',
  'apostrophe-notifications': '@apostrophecms/notification',
  'apostrophe-schemas': '@apostrophecms/schema',
  'apostrophe-docs': '@apostrophecms/doc',
  'apostrophe-jobs': '@apostrophecms/job',
  'apostrophe-attachments': '@apostrophecms/attachment',
  'apostrophe-oembed': '@apostrophecms/oembed',
  'apostrophe-pager': '@apostrophecms/pager',
  'apostrophe-global': '@apostrophecms/global',
  'apostrophe-polymorphic-manager': '@apostrophecms/polymorphic-type',
  'apostrophe-pages': '@apostrophecms/page',
  'apostrophe-search': '@apostrophecms/search',
  'apostrophe-any-page-manager': '@apostrophecms/any-page-type',
  'apostrophe-areas': '@apostrophecms/area',
  'apostrophe-rich-text-widgets': '@apostrophecms/rich-text-widget',
  'apostrophe-html-widgets': '@apostrophecms/html-widget',
  'apostrophe-video-widgets': '@apostrophecms/video-widget',
  // TODO flag apostrophe-groups as an area for an enterprise conversation
  'apostrophe-users': '@apostrophecms/user',
  'apostrophe-images': '@apostrophecms/image',
  // TODO linter must flag potential loss of content here as the old
  // widget was a slideshow and the new one only handles one image
  // (our content migrator also tries to figure this out)
  'apostrophe-images-widgets': '@apostrophecms/image-widget',
  'apostrophe-files': '@apostrophecms/file',
  'apostrophe-module': '@apostrophecms/module',
  'apostrophe-widgets': '@apostrophecms/widget-type',
  'apostrophe-custom-pages': '@apostrophecms/page-type',
  'apostrophe-pieces': '@apostrophecms/piece-type',
  'apostrophe-pieces-pages': '@apostrophecms/piece-page-type',
  // TODO linter must flag apostrophe-pieces-widgets or reinvent it
  'apostrophe-doc-type-manager': '@apostrophecms/doc-type'
};

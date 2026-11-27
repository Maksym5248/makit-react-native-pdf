// Jest runs CommonJS; the production Webpack build below verifies the actual worker URL.
module.exports = ({ types }) => ({ visitor: { MetaProperty(path) {
    path.replaceWith(types.objectExpression([types.objectProperty(types.identifier('url'), types.stringLiteral('file:///test/pdf-reader.web.tsx'))]));
} } });

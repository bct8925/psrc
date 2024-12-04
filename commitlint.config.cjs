const { RuleConfigSeverity } = require('@commitlint/types');

module.exports = {
  parserPreset: 'conventional-changelog-conventionalcommits',
  rules: {
    'body-empty': [RuleConfigSeverity.Warning, 'always'],
  },
};

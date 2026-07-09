/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '^react$': '<rootDir>/node_modules/react',
    '^react/jsx-runtime$': '<rootDir>/node_modules/react/jsx-runtime.js',
    '^react/jsx-dev-runtime$': '<rootDir>/node_modules/react/jsx-dev-runtime.js',
    '^react-dom$': '<rootDir>/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/node_modules/react-dom/$1',
    '^react-hook-form$': '<rootDir>/node_modules/react-hook-form/dist/index.cjs.js',
    '^react-router-dom$': '<rootDir>/node_modules/react-router-dom/dist/index.js',
    '^classnames$': '<rootDir>/node_modules/classnames/index.js',
    '^@fortawesome/(.*)$': '<rootDir>/node_modules/@fortawesome/$1',
    '^@tiptap/(.*)$': '<rootDir>/node_modules/@tiptap/$1',
    // CSS / SCSS modules → identity-obj-proxy (must come before the @/ alias)
    '\\.(css|scss|sass)$': '<rootDir>/node_modules/identity-obj-proxy',
    // Static assets → simple string stub
    '\\.(jpg|jpeg|png|gif|svg|ico|webp)$': '<rootDir>/src/__mocks__/fileMock.cjs',
    // Path alias: @/ → src/
    '^@jerecocc/tracker-ui$': '<rootDir>/../../tracker-ui/src/index.ts',
    '^@jerecocc/tracker-ui/components/Modal/backgroundScrollLock$':
      '<rootDir>/../../tracker-ui/src/components/Modal/backgroundScrollLock.ts',
    '^@jerecocc/tracker-ui/components/(.*)$': '<rootDir>/../../tracker-ui/src/components/$1.tsx',
    '^@jerecocc/tracker-ui/BreadcrumbTitleRow$':
      '<rootDir>/../../tracker-ui/src/components/Breadcrumbs/BreadcrumbTitleRow.tsx',
    '^@jerecocc/tracker-ui/backgroundScrollLock$':
      '<rootDir>/../../tracker-ui/src/components/Modal/backgroundScrollLock.ts',
    '^@jerecocc/tracker-ui/context/(BreadcrumbContext|MobileTabsContext|ThemeContext|TitleRowContext)$':
      '<rootDir>/../../tracker-ui/src/context/$1.ts',
    '^@jerecocc/tracker-ui/context/ThemeProvider$':
      '<rootDir>/../../tracker-ui/src/context/ThemeProvider.tsx',
    '^@jerecocc/tracker-ui/lib/(color|descriptionHtml)$':
      '<rootDir>/../../tracker-ui/src/lib/$1.ts',
    '^@jerecocc/tracker-ui/(Accordion|ActionOverlay|AddRowBar|Badge|Banner|BorderedFieldset|Breadcrumbs|BulkCreateModal|Button|Card|Checkbox|CheckboxAccordion|CheckboxField|Checklist|Chip|ColorSwatch|ConfirmModal|DatePicker|DescriptionEditor|Divider|EntityHeader|Field|FitText|GroupedFields|GroupTeamCount|Icon|ImagePreviewModal|InfoItem|InfoTooltip|ListItem|LoadingSpinner|LogoUpload|Modal|MonthCalendar|MoreActionsMenu|MultiSelect|Pagination|PeriodPicker|PlayerAvatar|RadioButton|RadioList|ReadOnlyField|ReorderableField|RichTextEditor|SearchableList|SearchField|Section|SegmentedControl|Select|SelectableList|SelectableListItem|Skeleton|StatItem|StickyHeroCard|Table|Tabs|Tag|TeamLogo|TimePicker|TitleRow|ToggleButton|Tooltip)$':
      '<rootDir>/../../tracker-ui/src/components/$1/$1.tsx',
    '^tracker-ui$': '<rootDir>/../../tracker-ui/src/index.ts',
    '^tracker-ui/(.*)$': '<rootDir>/../../tracker-ui/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};


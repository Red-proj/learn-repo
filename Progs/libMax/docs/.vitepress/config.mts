import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'libMax Docs',
  description: 'Documentation for maxbot-go and maxbot-js',
  base: '/learn-repo/',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'maxbot-go', link: '/go/overview' },
      { text: 'maxbot-js', link: '/js/overview' },
      { text: 'Project', link: '/project/roadmap' }
    ],
    sidebar: {
      '/go/': [
        {
          text: 'maxbot-go',
          items: [
            { text: 'Overview', link: '/go/overview' },
            { text: 'Stability', link: '/go/stability' },
            { text: 'Changelog', link: '/go/changelog' }
          ]
        }
      ],
      '/js/': [
        {
          text: 'maxbot-js',
          items: [
            { text: 'Overview', link: '/js/overview' },
            { text: 'Cookbook', link: '/js/cookbook' },
            { text: 'Changelog', link: '/js/changelog' }
          ]
        }
      ],
      '/project/': [
        {
          text: 'Project',
          items: [
            { text: 'Roadmap', link: '/project/roadmap' },
            { text: 'Release Checklist', link: '/project/release' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Red-proj/learn-repo' }
    ]
  }
});

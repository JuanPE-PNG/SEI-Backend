import { secureHeaders } from 'hono/secure-headers'
import type { MiddlewareHandler } from 'hono'
import { env } from '../config/env.js'

const isProd = env.NODE_ENV === 'production'

export const securityMiddleware: MiddlewareHandler = secureHeaders({
  ...(isProd && {
    contentSecurityPolicy: {
      defaultSrc:     ["'none'"],
      scriptSrc:      ["'none'"],
      styleSrc:       ["'none'"],
      imgSrc:         ["'none'"],
      connectSrc:     ["'self'"],
      frameAncestors: ["'none'"],
    },
    strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  }),
  xContentTypeOptions:  'nosniff',
  xFrameOptions:        'DENY',
  referrerPolicy:       'strict-origin-when-cross-origin',
  permissionsPolicy: {
    camera:      [],
    microphone:  [],
    geolocation: [],
  },
})

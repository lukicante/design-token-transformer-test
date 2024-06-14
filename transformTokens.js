const StyleDictionary = require('style-dictionary')
const deepMerge = require("deepmerge");
const webConfig = require('./src/web/index.js')
const androidConfig = require("./src/android/index.js");
const Color = require('tinycolor2');
const {createPropertyFormatter, sortByName} = StyleDictionary.formatHelpers;
const fs = require('fs');
const {exec} = require('child_process');

const isColor = (token) => token ? token.type === 'color' : false;
const isGradient = (token) => token ? token.type === 'custom-gradient' : false;
const isBlur = (token) => token ? token.type === 'custom-blur' : false;
const isShadow = (token) => token ? token.type === 'custom-shadow' : false;
const isLightmode = (token) => token ? token.path.some((val) => val === 'ui') : false;
const isDarkmode = (token) => token ? token.path.some((val) => val === 'darkUi') : false;
const isFont = (token) => token ? token.path.some((val) => val === 'font') : false;
const isBrand = (token) => token ? token.filePath === '../../../../tokens/figma-import/brand.tokens.json' : false;
const isSpacing = (token) => token ? token.path.some((val) => val === 'spacing') && !token.path.some((val) => val === 'primitives') : false;
const isBreakpoint = (token) => token ? token.path.some((val) => val === 'breakpoints') : false;
const isRadius = (token) => token ? (token.path.some((val) => val === 'radius') && !token.path.some((val) => val === 'primitives')) : false;

const normalizeColor = (colorString) => {
    const color = Color(colorString);
    return color.toHexString();
};

fs.readFile("tokens/global-ds.tokens.json", 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading the file:', err);
        process.exit(1);
    }

    try {
        const jsonData = JSON.parse(data);
        console.log('File Contents:', jsonData);
    } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
    }
});

const truncateComponentVersionDescription = (description) => {
    const index = description?.lastIndexOf('---\n');
    if (index == null || index === -1) {
        return description;
    }
    return description.substring(index + 4);
};

const fonts = {
    'Trip Sans': `ta_font_regular`,
    'Trip Sans Mono': `ta_font_mono`,
};

const tokenToFontValue = (fontToken) => {
    const {fontStyle, fontStyleRaw, fontSize, lineHeight, fontFamily} = fontToken.value;
    return `<item name="fontWeight">${toFontWeight(fontStyleRaw)}</item>    
        <item name="textSize">${fontSize}sp</item>    
        <item name="fontFamily">@font/${fonts[fontFamily]}</item>`;
};

const toFontWeight = (style) => {
    if (style ? style.includes('Regular') : false) {
        return 'ta_font_regular';
    }
    if (style ? style.includes('Medium') : false) {
        return 'ta_font_medium';
    }
    if (style ? style.includes('Bold') : false) {
        return 'ta_font_bold';
    }
    if (style ? style.includes('Ultra') : false) {
        return 'ta_font_ultra';
    }
    return 'ta_font_regular';
};

const tokenToBlurValue = (blurToken) => `blur(${blurToken.value.radius}dp)`;

const tokenToShadowValue = (shadowToken) => {
    const {radius, color, offsetX, offsetY, spread} = shadowToken.value;
    const colorNormalized = normalizeColor(color);
    return `${offsetX}px ${offsetY}px ${radius}px ${spread}px ${colorNormalized}`.replace(
        /0px/g,
        '0',
    );
};

const toPixelValue = (num) => `${num}${num > 0 ? 'dp' : ''}`;

const tokenToPixelValue = (sizeToken) => toPixelValue(sizeToken.value);

const tokenToGridValue = (gridToken) => {
    if (gridToken.name.includes('Columns')) {
        // return `${gridToken.value}`;
        return null;
    }
    if (gridToken.value === 0) {
        return null;
    }
    return tokenToPixelValue(gridToken);
};


const transformToken = (token) => {
    if (isColor(token)) {
        return normalizeColor(token.value);
    }
    if (isFont(token)) {
        return tokenToFontValue(token);
    }
    if (isBlur(token)) {
        return tokenToBlurValue(token);
    }
    if (isShadow(token)) {
        return tokenToShadowValue(token);
    }
    if (isSpacing(token) || isBreakpoint(token)) {
        return tokenToPixelValue(token);
    }
    if (isRadius(token)) {
        return tokenToPixelValue(token);
    }
};

const getResourceType = (tokenMap, token) => {
    if (isColor(token)) {
        return `<resources>\n${
            Array.from(tokenMap.keys())
                .sort()
                .map((name) => `\t<color name="${name.replace('-', '_')}">${tokenMap.get(name).value}</color>`)
                .join('\n')}\n</resources>`
    }
    if (isFont(token)) {
        return `<resources>\n${
            Array.from(tokenMap.keys())
                .sort()
                .map((name) => `\t<style name="${name}" parent="Base.TextAppearance.TA">
\t\t${tokenMap.get(name).value}\n
</style>`)
                .join('\n')}\n</resources>`
    }
    if (isBlur(token)) {
        return tokenToBlurValue(token);
    }
    if (isShadow(token)) {
        return tokenToShadowValue(token);
    }
    if (isSpacing(token) || isBreakpoint(token)) {
        return `<resources>\n${
            Array.from(tokenMap.keys())
                .sort()
                .map((name) => `\t<dimen name="${name}">${tokenMap.get(name).value}</dimen>`)
                .join('\n')}\n</resources>`;
    }
    if (isRadius(token)) {
        return `<resources>\n${
            Array.from(tokenMap.keys())
                .sort()
                .map((name) => `\t<dimen name="${name}">${tokenMap.get(name).value}</dimen>`)
                .join('\n')}\n</resources>`;
    }
    return `<resources>\n${
        Array.from(tokenMap.keys())
            .sort()
            .map((name) => `\t<color name="${name}">${tokenMap.get(name).value}</color>`)
            .join('\n')}\n</resources>`
}

StyleDictionary.registerTransform({
    name: 'color',
    type: 'value',
    matcher: isLightmode || isDarkmode,
    transformer: (token) => {
        return normalizeColor(token.value)
    },
});

StyleDictionary.registerTransform({
    name: 'dimen',
    type: 'value',
    matcher: isSpacing || isBreakpoint,
    transformer: (token) => {
        return `${token.value}dp`
    },
});

const getName = (token) => {
    const {name} = token;
    if (name && name.startsWith('spacing')) {
        // assumes the name is like spacing01, and we want to turn it into spacing-01
        return name.substring(0, 7) + '-' + name.substring(7);
    }
    // Replace any space character with a dash
    // For now this is only applicable to the brand color tokes, which are exported from figma with spaces in their names
    return name.replace(/\s/gi, "-");
};

StyleDictionary.registerFormat({
    name: 'android/xml',
    formatter: function (dictionary) {
        const tokenMap = new Map();
        let resource = null
        dictionary.allTokens.map((token) => {
            const description = truncateComponentVersionDescription(token.description);
            const value = transformToken(token);
            if (value != null) {
                tokenMap.set(getName(token), {
                    description: description !== value ? description : null,
                    value,
                });
            }
            resource = getResourceType(tokenMap, token)
        });
        return resource
    }
});

StyleDictionary.registerTransform({
  name: 'size/px',
  type: 'value',
  matcher: token => {
    return (token.unit === 'pixel' || token.type === 'dimension') && token.value !== 0
  },
  transformer: token => {
    return `${token.value}px`
  }
})

StyleDictionary.registerTransform({
  name: 'size/percent',
  type: 'value',
  matcher: token => {
    return token.unit === 'percent' && token.value !== 0
  },
  transformer: token => {
    return `${token.value}%`
  }
})

StyleDictionary.registerFilter({
  name: 'validToken',
  matcher: function(token) {
    return [
      "dimension",
      "string",
      "number",
      "color",
      "custom-spacing",
      "custom-gradient",
      "custom-fontStyle",
      "custom-radius",
      "custom-shadow",
    ].includes(token.type);
  }
})

const StyleDictionaryExtended = StyleDictionary.extend({
  ...deepMerge.all([androidConfig, webConfig]),
  source: ["tokens/*.json"],
  platforms: {
      android: {
          transforms: [
              'attribute/color',
              'dimen'
          ],
          buildPath: "build/xml/",
          files: [
              {
                  destination: 'brand.xml',
                  format: 'android/xml',
                  transform: 'attribute/color',
                  filter: (token) => isColor(token) && isBrand(token),
              },
              {
                  destination: 'breakpoints.xml',
                  format: 'android/xml',
                  transform: 'dimen',
                  filter: isBreakpoint,
              },
              {
                  destination: 'lightmode.xml', // Output file name
                  format: 'android/xml',
                  transform: 'attribute/color',
                  filter: (token) => (isColor(token) || isGradient(token)) && isLightmode(token) && !isBrand(token),
              },
              {
                  destination: 'darkmode.xml',
                  format: 'android/xml',
                  transform: 'attribute/color',
                  filter: (token) =>
                      (isColor(token) || isGradient(token)) && isDarkmode(token) && !isBrand(token),
              },
              {
                  destination: 'typography.xml',
                  format: 'android/xml',
                  filter: isFont,
              },
              {
                  destination: 'radii.xml',
                  format: 'android/xml',
                  transform: 'dimen',
                  filter: isRadius,
              },
              {
                  destination: 'spacing.xml',
                  format: 'android/xml',
                  filter: isSpacing,
              },
          ],
      },
    scss: {
      transformGroup: "custom/css",
      buildPath: "build/scss/",
      files: [
        {
          destination: "_variables.scss",
          format: "scss/variables",
          filter: "validToken",
        },
      ],
    },
    less: {
      transformGroup: "custom/css",
      buildPath: "build/less/",
      files: [
        {
          destination: "_variables.less",
          format: "less/variables",
          filter: "validToken",
        },
      ],
    },
    css: {
      transformGroup: "custom/css",
      buildPath: "build/css/",
      files: [
        {
          destination: "_variables.css",
          format: "css/variables",
          filter: "validToken",
          options: {
            showFileHeader: false,
          },
        },
      ],
    },
    "json-flat": {
      transformGroup: "js",
      buildPath: "build/json/",
      files: [
        {
          destination: "styles.json",
          format: "json/flat",
          filter: "validToken",
        },
      ],
    },
    ios: {
      transformGroup: "ios",
      buildPath: "build/ios/",
      files: [
        {
          destination: "StyleDictionaryColor.h",
          format: "ios/colors.h",
          className: "StyleDictionaryColor",
          type: "StyleDictionaryColorName",
          filter: {
            type: "color",
          },
        },
        {
          destination: "StyleDictionaryColor.m",
          format: "ios/colors.m",
          className: "StyleDictionaryColor",
          type: "StyleDictionaryColorName",
          filter: {
            type: "color",
          },
        },
        {
          destination: "StyleDictionarySize.h",
          format: "ios/static.h",
          className: "StyleDictionarySize",
          type: "float",
          filter: {
            type: "number",
          },
        },
        {
          destination: "StyleDictionarySize.m",
          format: "ios/static.m",
          className: "StyleDictionarySize",
          type: "float",
          filter: {
            type: "number",
          },
        },
      ],
    },

    "ios-swift-separate-enums": {
      transformGroup: "ios-swift-separate",
      buildPath: "build/ios-swift/",
      files: [
        {
          destination: "StyleDictionaryColor.swift",
          format: "ios-swift/enum.swift",
          className: "StyleDictionaryColor",
          filter: {
            type: "color",
          },
        },
        {
          destination: "StyleDictionarySize.swift",
          format: "ios-swift/enum.swift",
          className: "StyleDictionarySize",
          type: "float",
          filter: {
            type: "number",
          },
        },
      ],
    },
  },
});

StyleDictionaryExtended.buildAllPlatforms()
import * as React from "react";
import { render } from "react-dom";

import ShadertoyWrapper from "./ShadertoyWrapper";
import { Controlled as CodeMirrorEditor } from "react-codemirror2";

import useLocalStorage from "./useLocalStorage";
// require("codemirror/mode/xml/xml");
// require("codemirror/mode/javascript/javascript");
import "./styles.css";
import "ress/ress.css";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
import CodeMirror from "codemirror";
import useStableCallback from "./useStableCallback.js";

require("./glsl.js")(CodeMirror);

const { useState, useEffect, useRef } = React;

const initialFs = `
float checker(vec2 uv, float repeats) 
{
  float cx = floor(repeats * uv.x);
  float cy = floor(repeats * uv.y); 
  float result = mod(cx + cy, 2.0);
  return sign(result);
}
 

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  vec2 uv = fragCoord.xy/iResolution.xy;
  vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
  
  float c = mix(col.r, col.g, checker(uv, 24.455555555555550));
   
  fragColor = vec4(c,c,c,1.0);
}

`;
const REGEX = /(?:^|\W)([0-9]*(\.?[0-9]*))$/;
const REGEX2 = /^[0-9]+(?![.0-9])|^([0-9]*)(\.([0-9]+)?)/;

// const getCursor = (line, charPos) => {
//   let preMatch = line.substring(0, charPos).match(REGEX);
//   if (!preMatch) return;
//   preMatch = preMatch[1];

//   const rest = line.substring(charPos - preMatch.length);
//   let restMatch = rest.match(REGEX2);
//   if (!restMatch) return;
//   console.log(restMatch);
//   let numberString = restMatch[0];
//   if (restMatch[2] && !restMatch[1]) numberString = "0" + numberString;
//   if (restMatch[2] && !restMatch[3]) numberString += "0";
//   return {
//     start: charPos - preMatch.length,
//     end: charPos - preMatch.length + restMatch[0].length,
//     string: restMatch[0],
//     number: Number(numberString),
//     isFloat: !!restMatch[2]
//   };
// };
const getCursor = (editor, pos, { tokenIdsByPosition }) => {
  // const line = doc.getLine(pos.line);
  // const cursor = getCursor(line, pos.ch);
  // if (!cursor) return;
  // return {
  //   ...cursor,
  //   startPos: doc.indexFromPos({ line: pos.line, ch: cursor.start }),
  //   endPos: doc.indexFromPos({ line: pos.line, ch: cursor.end })
  // };
  const tokenLeft = editor.getTokenAt(pos);
  const tokenRight = editor.getTokenAt({ ...pos, ch: pos.ch + 1 });
  const token = tokenLeft.type === "number" ? tokenLeft : tokenRight;
  if (!token || token.type !== "number") return;

  if (token.string.indexOf(".") === -1) return;

  // console.log(
  //   pos.line + "," + token.start,
  //   tokenIdsByPosition[pos.line + "," + token.start]
  // );
  console.log(token);
  return {
    string: token.string,
    pos: { line: pos.line, ch: token.start },
    number: stringToNumber(token.string),
    tokenId: tokenIdsByPosition[pos.line + "," + token.start]
  };
};

const Slider = ({ value, min = 0, max = 1, onHoverValue, onValue }) => {
  const [hoverValue, setHoverValue] = useState(value);
  const onMouseMove = (ev: React.MouseEvent<HTMLInputElement, MouseEvent>) => {
    const x =
      ev.nativeEvent.offsetX / (ev.target as HTMLInputElement).clientWidth;
    const newValue = min + x * (max - min);
    setHoverValue(newValue);
    onHoverValue && onHoverValue(newValue);
  };
  const onMouseOut = () => {
    setHoverValue(value);
    onHoverValue && onHoverValue(null);
  };
  const onClick = (ev: React.MouseEvent<HTMLInputElement, MouseEvent>) => {
    const x =
      ev.nativeEvent.offsetX / (ev.target as HTMLInputElement).clientWidth;
    const value = min + x * (max - min);
    onValue && onValue(value);
    ev.stopPropagation();
    ev.preventDefault();
    return false;
  };
  useEffect(() => {
    setHoverValue(value);
  }, [value]);
  return (
    <View display="flex" flexDirection="row">
      <View as="pass" flex={1} paddingTop={8} paddingBottom={8}>
        <input
          value={hoverValue}
          min={min}
          max={max}
          step={0.001}
          type="range"
          onMouseMove={onMouseMove}
          onMouseOut={onMouseOut}
          onClickCapture={onClick}
          onChange={() => {}}
        />
      </View>
      <View
        as="span"
        whiteSpace="nowrap"
        width={40}
        pointerEvents="none"
        textAlign="right"
      >
        {hoverValue || hoverValue === 0 ? hoverValue.toFixed(2) : null}
      </View>
    </View>
  );
};

const View = ({ as = "div", children, ...rest }) => {
  if (as === "pass") return React.cloneElement(children, { style: rest });
  return React.createElement(as, { style: rest }, children);
};
const Row = props => <View display="flex" flexDirection="row" {...props} />;
const Column = props => (
  <View display="flex" flexDirection="column" {...props} />
);

const stringToNumber = string => {
  if (string[0] === ".") return Number("0" + string);
  else if (string[string.length - 1] === ".") return Number(string + "0");
  return Number(string);
};

const handleTokens = (editor, text) => {
  const lines = text.split("\n");
  const tokenIdsByPosition = {};
  const initialValues = [];
  let buffer = [];

  let gotMain = false;

  for (let i = 0; i < editor.getDoc().lineCount(); i++) {
    let lastOffset = 0;

    const line = lines[i];

    const tokens = editor.getLineTokens(i, false);
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type === "number" && t.string.indexOf(".") >= 0) {
        buffer.push(line.substring(lastOffset, t.start));

        const tokenId = initialValues.length;
        buffer.push(`uNumbers[${tokenId}]`);
        lastOffset = t.end;
        tokenIdsByPosition[i + "," + t.start] = tokenId;
        initialValues.push(stringToNumber(t.string));
      }
    }

    buffer.push(line.substring(lastOffset));
    const trimLine = line.trim();
    if (trimLine.startsWith("void mainImage")) {
      gotMain = true;
    }
    if (gotMain && trimLine.endsWith(";")) {
      const match = trimLine.match("(\\S+)\\s+(\\S+)");
      if (match[1] === "vec3") {
        buffer.push(
          `if (uState == ${i}) { fragColor = vec4(${match[2]}, 1.); return; }`
        );
      } else if (match[1] === "vec2") {
        buffer.push(
          `if (uState == ${i}) { fragColor = vec4(${
            match[2]
          }, 0., 1.); return; }`
        );
      } else if (match[1] === "float") {
        buffer.push(
          `if (uState == ${i}) { fragColor = vec4(${[
            match[2],
            match[2],
            match[2]
          ]}, 1.); return; }`
        );
      }
    }
    buffer.push("\n");
  }

  console.log(buffer.join(""));
  return {
    text: buffer.join(""),
    tokenIdsByPosition,
    uniforms: new Float32Array(initialValues)
  };

  // console.log(buffer.join(""));
  // console.log(numberTokens);
};

function App() {
  const [editorText, setEditorText] = useLocalStorage("editor", initialFs);
  // const [underlyingFs, setUnderlyingFs] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [shaderState, setShaderState] = useState({
    text: "",
    tokenIdsByPosition: {},
    uniforms: new Float32Array([])
  });
  const oldUniformValue = useRef(null);
  const editorRef = useRef();

  // const [uniforms, setUniforms] = useState(new Float32Array([]));

  const onHoverValue = (value?: number) => {
    if (!value) {
      setUniform(null);
      return;
    }
    setUniform(value);
    // const newText =
    //   fs.substring(0, cursor.startPos) +
    //   value.toFixed(2) +
    //   fs.substring(cursor.endPos);
    // setUnderlyingFs(newText);
  };

  const onValue = (value: number) => {
    // setUniforms(value);

    console.log(cursor);

    const doc = editorRef.current.getDoc();

    const index = doc.indexFromPos(cursor.pos);
    const newText =
      editorText.substring(0, index) +
      value +
      editorText.substring(index + cursor.string.length - 1);
    console.log(newText);
    setEditorText(newText);

    // const newText =
    //   fs.substring(0, cursor.startPos) +
    //   value.toFixed(2) +
    //   fs.substring(cursor.endPos);
    // setFs(newText);
    // setUnderlyingFs(null);
  };

  const setUniform = useStableCallback(value => {
    if (!value && value !== 0) {
      value = oldUniformValue.current;
      oldUniformValue.current = null;
    } else if (!oldUniformValue.current) {
      oldUniformValue.current = shaderState.uniforms[cursor.tokenId];
    }
    shaderState.uniforms[cursor.tokenId] = value;
    setShaderState(shaderState);
  });
  const onCursor = useStableCallback((editor, pos) => {
    setCursor(
      getCursor(editor, pos, {
        tokenIdsByPosition: shaderState.tokenIdsByPosition
      })
    );
  });

  return (
    <Row height="100%">
      <Column width={800} height="100%">
        <CodeMirrorEditor
          value={editorText}
          options={{ mode: "glsl" }}
          onBeforeChange={(editor, data, text) => {
            console.log(data, text);
            setEditorText(text);
            setShaderState(handleTokens(editor, text));
            onCursor(editor, editor.getCursor());
            // setUnderlyingFs(null);
            // setFs(value);
          }}
          onChange={(...args) => {
            //console.log("onChange", args);
          }}
          onCursor={onCursor}
          className="codemirrorcontainer"
          editorDidMount={editor => {
            editorRef.current = editor;
            setShaderState(handleTokens(editor, editor.getDoc().getValue()));
          }}
        />
        <style>{`
          .codemirrorcontainer { flex: 1; position: relative }
          .codemirrorcontainer .CodeMirror { 
            position: absolute;
            left: 0;
            top: 0;
            right: 0;
            bottom: 0;
            height: 100%;
          }
          .CodeMirror-scroll {
            padding-bottom: 200px;
          }
          `}</style>

        <Row alignItems="center" padding={8} height={120}>
          <View marginRight={16} width={100} height={100}>
            <ShadertoyWrapper
              fs={shaderState.text}
              uniforms={{
                uNumbers: { type: "1fv", value: shaderState.uniforms },
                uState: {
                  type: "1i",
                  value: console.log(cursor) || cursor ? cursor.pos.line : -1
                }
              }}
            />
          </View>
          {cursor ? (
            <Column width={400}>
              <Slider
                min={cursor.number - 0.2}
                max={cursor.number + 0.2}
                value={cursor.number}
                onHoverValue={onHoverValue}
                onValue={onValue}
              />
              <Slider
                min={cursor.number - 2}
                max={cursor.number + 2}
                value={cursor.number}
                onHoverValue={onHoverValue}
                onValue={onValue}
              />
              <Slider
                min={cursor.number - 20}
                max={cursor.number + 20}
                value={cursor.number}
                onHoverValue={onHoverValue}
                onValue={onValue}
              />
              <Slider
                min={cursor.number - 200}
                max={cursor.number + 200}
                value={cursor.number}
                onHoverValue={onHoverValue}
                onValue={onValue}
              />
            </Column>
          ) : null}
        </Row>
        {/* <pre>{JSON.stringify(cursor, null, 2)}</pre> */}

        {/* <textarea
          style={{ width: "100%", height: 200, fontFamily: "monospace" }}
          value={fs}
          onChange={ev => setFs(ev.target.value)}
        /> */}
      </Column>
      <View flex="1">
        <ShadertoyWrapper
          fs={shaderState.text}
          uniforms={{
            uNumbers: { type: "1fv", value: shaderState.uniforms },
            uState: { type: "1i", value: -1 }
          }}
        />
      </View>
    </Row>
  );
}

const rootElement = document.getElementById("root");
render(<App />, rootElement);

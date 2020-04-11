import * as React from "react";
import ShadertoyReact from "shadertoy-react";

const { useState, useEffect, useRef } = React;

const BASIC_FS =
  // Basic shadertoy shader
  `void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  vec2 uv = fragCoord/iResolution.xy;
  vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
  fragColor = vec4(col,1.0);
}`;

const BASIC_VS = `attribute vec3 aVertexPosition;
void main(void) {
  gl_Position = vec4(aVertexPosition, 1.0);
}`;

const ShadertoyWrapper = ({
  fs,
  vs,
  ...props
}: {
  fs?: string;
  vs?: string;
}) => {
  const ref = useRef();

  useEffect(() => {
    ref.current.processCustomUniforms();
    const shaders = ref.current.preProcessShaders(
      fs || BASIC_FS,
      vs || BASIC_VS
    );
    ref.current.initShaders(shaders);
    ref.current.initBuffers();
    ref.current.onResize();
  }, [fs, vs]);

  return (
    <ShadertoyReact
      {...props}
      fs={fs || BASIC_FS}
      vs={vs || BASIC_VS}
      ref={ref}
    />
  );
};

export default ShadertoyWrapper;

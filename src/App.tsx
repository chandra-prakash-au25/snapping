import Konva from "konva";
import React from "react";
import { Stage, Layer } from "react-konva";

const GUIDELINE_OFFSET = 5;

type Snap = "start" | "center" | "end";
type SnappingEdges = {
  vertical: Array<{
    guide: number;
    offset: number;
    snap: Snap;
  }>;
  horizontal: Array<{
    guide: number;
    offset: number;
    snap: Snap;
  }>;
};

export const App: React.FC = () => {
  const stageRef = React.useRef<Konva.Stage>(null);
  const layerRef = React.useRef<Konva.Layer>(null);

  const getLineGuideStops = (skipShape: Konva.Shape) => {
    const stage = skipShape.getStage();//Finding parent stage if not returning empty snaps
    if (!stage) return { vertical: [], horizontal: [] };
    //Here adding snap for stage center and corners
    // we can snap to stage borders and the center of the stage
    const vertical = [0, stage.width() / 2, stage.width()];
    const horizontal = [0, stage.height() / 2, stage.height()];

    //finding all object with name object and skip current object
    // and we snap over edges and center of each object on the canvas 
    stage.find(".object").forEach((guideItem) => {
      if (guideItem === skipShape) {
        return;
      }
      // getClientRect is a function that calcualte absolute boudning box of any Konva.Node.
      const box = guideItem.getClientRect();
      // and we can snap to all edges of shapes
      //here pushing all object co-ordinate start,end and center
      vertical.push(box.x, box.x + box.width, box.x + box.width / 2);
      horizontal.push(box.y, box.y + box.height, box.y + box.height / 2);
    });
    return {
      vertical,
      horizontal
    };
  };

  const getObjectSnappingEdges = React.useCallback(
    (node: Konva.Shape): SnappingEdges => {
      const box = node.getClientRect();
      //absolutePosition function finding the current position of the assets 
      const absPos = node.absolutePosition();
      return {
        vertical: [
          {
            guide: Math.round(box.x),
            offset: Math.round(absPos.x - box.x),
            snap: "start"
          },
          {
            guide: Math.round(box.x + box.width / 2),
            offset: Math.round(absPos.x - box.x - box.width / 2),
            snap: "center"
          },
          {
            guide: Math.round(box.x + box.width),
            offset: Math.round(absPos.x - box.x - box.width),
            snap: "end"
          }
        ],
        horizontal: [
          {
            guide: Math.round(box.y),
            offset: Math.round(absPos.y - box.y),
            snap: "start"
          },
          {
            guide: Math.round(box.y + box.height / 2),
            offset: Math.round(absPos.y - box.y - box.height / 2),
            snap: "center"
          },
          {
            guide: Math.round(box.y + box.height),
            offset: Math.round(absPos.y - box.y - box.height),
            snap: "end"
          }
        ]
      };
    },
    []
  );

  const getGuides = React.useCallback(
    (
      lineGuideStops: ReturnType<typeof getLineGuideStops>,
      itemBounds: ReturnType<typeof getObjectSnappingEdges>
    ) => {
      const resultV: Array<{
        lineGuide: number;
        diff: number;
        snap: Snap;
        offset: number;
      }> = [];

      const resultH: Array<{
        lineGuide: number;
        diff: number;
        snap: Snap;
        offset: number;
      }> = [];

      lineGuideStops.vertical.forEach((lineGuide) => {
        itemBounds.vertical.forEach((itemBound) => {
          const diff = Math.abs(lineGuide - itemBound.guide);
          if (diff < GUIDELINE_OFFSET) {
            resultV.push({
              lineGuide: lineGuide,
              diff: diff,
              snap: itemBound.snap,
              offset: itemBound.offset
            });
          }
        });
      });

      lineGuideStops.horizontal.forEach((lineGuide) => {
        itemBounds.horizontal.forEach((itemBound) => {
          const diff = Math.abs(lineGuide - itemBound.guide);
          if (diff < GUIDELINE_OFFSET) {
            resultH.push({
              lineGuide: lineGuide,
              diff: diff,
              snap: itemBound.snap,
              offset: itemBound.offset
            });
          }
        });
      });

      const guides: Array<{
        lineGuide: number;
        offset: number;
        orientation: "V" | "H";
        snap: "start" | "center" | "end";
      }> = [];

      const minV = resultV.sort((a, b) => a.diff - b.diff)[0];
      const minH = resultH.sort((a, b) => a.diff - b.diff)[0];

      if (minV) {
        guides.push({
          lineGuide: minV.lineGuide,
          offset: minV.offset,
          orientation: "V",
          snap: minV.snap
        });
      }

      if (minH) {
        guides.push({
          lineGuide: minH.lineGuide,
          offset: minH.offset,
          orientation: "H",
          snap: minH.snap
        });
      }

      return guides;
    },
    []
  );

  const drawGuides = React.useCallback(
    (guides: ReturnType<typeof getGuides>, layer: Konva.Layer) => {
      guides.forEach((lg) => {
        if (lg.orientation === "H") {
          const line = new Konva.Line({
            points: [-6000, 0, 6000, 0],
            stroke: "rgb(0, 161, 255)",
            strokeWidth: 1,
            name: "guid-line",
            dash: [4, 6]
          });
          layer.add(line);
          line.absolutePosition({
            x: 0,
            y: lg.lineGuide
          });
        } else if (lg.orientation === "V") {
          const line = new Konva.Line({
            points: [0, -6000, 0, 6000],
            stroke: "rgb(0, 161, 255)",
            strokeWidth: 1,
            name: "guid-line",
            dash: [4, 6]
          });
          layer.add(line);
          line.absolutePosition({
            x: lg.lineGuide,
            y: 0
          });
        }
      });
    },
    []
  );

  const onDragMove = React.useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const layer = e.target.getLayer();//finding parent layer

      // clear all previous lines on the screen
      layer.find(".guid-line").forEach((l: Konva.Shape) => l.destroy());

      // find possible snapping lines and passing argument shape that is dragging
      const lineGuideStops = getLineGuideStops(e.target as Konva.Shape);
      //lineGuidStops contains all points of assets edges except current element
      // find snapping points of current object
      const itemBounds = getObjectSnappingEdges(e.target as Konva.Shape);

      // now find where can we snap current object by passing items bound lineGuideStops and items bounds
      const guides = getGuides(lineGuideStops, itemBounds);

      // do nothing if no snapping
      if (!guides.length) {
        return;
      }

      drawGuides(guides, layer);

      const absPos = e.target.absolutePosition();
      // now force object position
      guides.forEach((lg) => {
        switch (lg.snap) {
          case "start": {
            switch (lg.orientation) {
              case "V": {
                absPos.x = lg.lineGuide + lg.offset;
                break;
              }
              case "H": {
                absPos.y = lg.lineGuide + lg.offset;
                break;
              }
            }
            break;
          }
          case "center": {
            switch (lg.orientation) {
              case "V": {
                absPos.x = lg.lineGuide + lg.offset;
                break;
              }
              case "H": {
                absPos.y = lg.lineGuide + lg.offset;
                break;
              }
            }
            break;
          }
          case "end": {
            switch (lg.orientation) {
              case "V": {
                absPos.x = lg.lineGuide + lg.offset;
                break;
              }
              case "H": {
                absPos.y = lg.lineGuide + lg.offset;
                break;
              }
            }
            break;
          }
        }
      });
      e.target.absolutePosition(absPos);
    },
    [drawGuides, getGuides, getObjectSnappingEdges]
  );


  //Below this line code understanding done
  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const layer = e.target.getLayer();
    // clear all previous lines on the screen
    layer.find(".guid-line").forEach((l: Konva.Shape) => l.destroy());
  };

  React.useEffect(() => {
    const stage = stageRef.current;
    const layer = layerRef.current;

    if (!stage || !layer) return;

    // first generate random rectangles
    for (let i = 0; i < 5; i++) {
      const rect = new Konva.Rect({
        x: Math.random() * stage.width(),
        y: Math.random() * stage.height(),
        width: 50 + Math.random() * 50,
        height: 50 + Math.random() * 50,
        fill: Konva.Util.getRandomColor(),
        // rotation: Math.random() * 360,
        draggable: true,
        name: "object"
      });

      rect.on("dragmove", (e: Konva.KonvaEventObject<DragEvent>) =>
        onDragMove(e)
      );
      rect.on("dragend", (e: Konva.KonvaEventObject<DragEvent>) =>
        onDragEnd(e)
      );

      layer.add(rect);
    }

    layer.draw();
  }, [onDragMove]);

  return (
    <div
      style={{ backgroundColor: "#f0f0f0", width: "100vw", height: "100vh" }}
    >
      <Stage
        ref={stageRef}
        width={window.innerWidth}
        height={window.innerHeight}
      >
        <Layer ref={layerRef} />
      </Stage>
    </div>
  );
};

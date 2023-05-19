import DeckGL from "@deck.gl/react/typed";
import { MapView, PickingInfo } from "@deck.gl/core/typed";
import { TileLayer } from "@deck.gl/geo-layers/typed";
import { PathLayer, PointCloudLayer } from "@deck.gl/layers/typed";
import { _Tileset2D as Tileset2D } from "@deck.gl/geo-layers/typed";

const INITIAL_VIEW_STATE = {
  latitude: 49.0765931,
  longitude: 9.298911,
  zoom: 15,
  maxZoom: 20,
  maxPitch: 89,
  bearing: 0,
};

const COPYRIGHT_LICENSE_STYLE = {
  position: "absolute",
  right: 0,
  bottom: 0,
  backgroundColor: "hsla(0,0%,100%,.5)",
  padding: "0 5px",
  font: "12px/20px Helvetica Neue,Arial,Helvetica,sans-serif",
};

const LINK_STYLE = {
  textDecoration: "none",
  color: "rgba(0,0,0,.75)",
  cursor: "grab",
};

function getTooltip(info: PickingInfo) {
  if ("tile" in (info as object)) {
    const tile = (info as any)["tile"];
    return `tile with index ${JSON.stringify(tile.index)}`;
  }
  return null;
}

// This implements the tiling scheme similar to the NDS scheme.
// See e.g. https://developer.here.com/documentation/fleet-telematics/dev_guide/topics/here-map-content.html
interface MyTileIndex {
  i: number;
  j: number;
  zoom: number;
}

function tileIndexId(index: MyTileIndex): string {
  return `${index.i}-${index.j}-${index.zoom}`;
}

function lonToTileIIndex(lon: number, z: number): number {
  const tile_size_angle = 180 / 2 ** z;
  return Math.floor((lon + 180) / tile_size_angle);
}

function latToTileJIndex(lat: number, z: number): number {
  const tile_size_angle = 180 / 2 ** z;
  return Math.floor((lat + 90) / tile_size_angle);
}

interface BoundingBox {
  west: number; // <longitude>
  north: number; // <latitude>
  east: number; // <longitude>
  south: number; // <latitude>
}

function getBoundingBoxOfTileIndex(index: MyTileIndex): BoundingBox {
  return {
    // The "reference" point of the tile is the lower left, i.e. south west point.
    south: tileJToLat(index.j, index.zoom),
    west: tileIToLon(index.i, index.zoom),
    // To get the upper right point, use reference point of the upper right neighbor.
    north: tileJToLat(index.j + 1, index.zoom),
    east: tileIToLon(index.i + 1, index.zoom),
  };
}

function tileIToLon(x: number, z: number): number {
  return (x / 2 ** z) * 180.0 - 180.0;
}

function tileJToLat(y: number, z: number): number {
  return (y / 2 ** z) * 180.0 - 90.0;
}

function viewportZoomToMyTileZoom(z: number): number {
  return z;
}

function myTileZoomToViewportZoom(z: number): number {
  return z;
}

function tilesCoveringBox(
  [lonMin, latMin, lonMax, latMax]: [number, number, number, number],
  zoom: number
): MyTileIndex[] {
  const xMin = lonToTileIIndex(lonMin, zoom);
  const yMin = latToTileJIndex(latMin, zoom);
  const xMax = lonToTileIIndex(lonMax, zoom);
  const yMax = latToTileJIndex(latMax, zoom);
  const indices: MyTileIndex[] = [];
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      indices.push({ i: x, j: y, zoom: zoom });
    }
  }
  return indices;
}

function getParent(index: MyTileIndex): MyTileIndex {
  if (index.zoom === 0) {
    return index;
  }
  return {
    i: Math.floor(index.i / 2),
    j: Math.floor(index.j / 2),
    zoom: index.zoom - 1,
  };
}

class MyTileSet extends Tileset2D {
  // sample implementation for slippy tiles in
  // node_modules/@deck.gl/geo-layers/src/tileset-2d/utils.ts
  // @ts-expect-error Tileset2D should be generic over TileIndex
  getTileIndices(props): MyTileIndex[] {
    // ignore initial viewport
    if (props.viewport.id == "DEFAULT-INITIAL-VIEWPORT") {
      return [];
    }

    let z = Math.floor(props.viewport.zoom);
    if (
      typeof props.minZoom === "number" &&
      Number.isFinite(props.minZoom) &&
      z < props.minZoom
    ) {
      z = props.minZoom;
    }
    if (
      typeof props.maxZoom === "number" &&
      Number.isFinite(props.maxZoom) &&
      z > props.maxZoom
    ) {
      z = props.maxZoom;
    }

    const indices = tilesCoveringBox(
      props.viewport.getBounds(),
      viewportZoomToMyTileZoom(z)
    );
    return indices;
  }

  // @ts-expect-error Tileset2D should be generic over TileIndex
  getTileId(index: MyTileIndex): string {
    return tileIndexId(index);
  }

  // @ts-expect-error Tileset2D should be generic over TileIndex
  getTileZoom(index: MyTileIndex): number {
    return myTileZoomToViewportZoom(index.zoom);
  }

  // @ts-expect-error Tileset2D should be generic over TileIndex
  getParentIndex(index: MyTileIndex): MyTileIndex {
    return getParent(index);
  }

  // @ts-expect-error Tileset2D should be generic over TileIndex
  getTileMetadata(index: MyTileIndex): Record<string, any> {
    return {
      bbox: getBoundingBoxOfTileIndex(index),
    };
  }
}

export function TileLayerExample({
  showBorder = false,
  useCustomTileset = false, // switch this to see how onHover fails with a custom tileset
}) {
  const tileLayer = new TileLayer({
    id: "TileLayerExample",
    getTileData: (tile) => {
      // console.log("Fetching data for tile", tile);
      return [];
    },

    // @ts-expect-error Tileset2D should be generic over TileIndex
    TilesetClass: (useCustomTileset && MyTileSet) || Tileset2D,

    maxRequests: 1,

    pickable: true,
    onHover: (i) => {
      if (i?.object?.description) {
        console.log("hovering over", i.object.description);
      } else {
        console.log("hover over", i);
      }
    },
    autoHighlight: showBorder,
    highlightColor: [60, 60, 60, 40],
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: (props) => {
      const { west, north, east, south } = (() => {
        if (useCustomTileset) {
          return getBoundingBoxOfTileIndex(
            props.tile.index as any as MyTileIndex
          );
        } else {
          const [[west, south], [east, north]] = props.tile.boundingBox;
          return { west: west, south: south, east: east, north: north };
        }
      })();

      return [
        showBorder &&
          new PathLayer({
            id: `${props.id}-border`,
            data: [
              [
                [west, north],
                [west, south],
                [east, south],
                [east, north],
                [west, north],
              ],
            ],
            getPath: (d) => d,
            getColor: [255, 0, 0],
            widthMinPixels: 4,
          }),
        new PointCloudLayer({
          ...props,
          id: `${props.id}-center`,
          data: [
            {
              position: [(west + east) / 2, (north + south) / 2, 0],
              description: "the center",
            },
          ],
          getPosition: (d) => d.position,
          sizeUnits: "pixels",
          pointSize: 20,
          getColor: [0, 255, 0, 200],
        }),
      ];
    },
  });

  return (
    <DeckGL
      layers={[tileLayer]}
      views={new MapView({ repeat: true })}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      getTooltip={getTooltip}
    >
      <div style={COPYRIGHT_LICENSE_STYLE}>
        {"© "}
        <a
          style={LINK_STYLE}
          href="http://www.openstreetmap.org/copyright"
          target="blank"
        >
          OpenStreetMap contributors
        </a>
      </div>
    </DeckGL>
  );
}

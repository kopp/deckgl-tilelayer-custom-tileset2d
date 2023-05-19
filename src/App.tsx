import "./App.css";
import { TileLayerExample } from "./components/TileLayerExample";

const useCustomTileset = true;

function App() {
  return (
    <>
      <h1>
        Tile Layer Example
        {(useCustomTileset && " with custom (NDS) tileset") ||
          " with default (OSM) tileset"}
      </h1>
      <TileLayerExample showBorder={true} useCustomTileset={useCustomTileset} />
    </>
  );
}

export default App;

import { createContext, useContext } from "react";

export const SearchContext = createContext({
  query: "",
  setQuery: (q: string) => {},
});

export const useSearch = () => useContext(SearchContext);

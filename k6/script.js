import http from "k6/http";

export const options = {
  vus: 100,
  duration: "2m",
};

export default function () {
  http.get("http://localhost/api/study/queue?limit=20");
}


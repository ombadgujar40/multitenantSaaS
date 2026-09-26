import http from "k6/http";
import { sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
};

export default function () {
  const params = {
    headers: {
      Authorization: `Bearer ${__ENV.K6_AUTH_TOKEN}`,
    },
  };

  http.get(
    "http://localhost:2000/project/getAllProjects?role=customer",
    params
  );

  sleep(1);
}
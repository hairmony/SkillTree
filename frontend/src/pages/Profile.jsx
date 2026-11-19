import React, { useEffect, useRef, useState } from "react";
import { PageTitle, url } from "../ui";

export function Avatar({ name }) {
  return (
    <span className="avatar" aria-hidden="true">
      {Array.from(name)[0].toLocaleUpperCase()}
    </span>
  );
}

export function ProfileMenu({ name, route }) {
  const menu = useRef(null);
  useEffect(() => {
    menu.current.open = false;
    function close(event) {
      if (!menu.current.contains(event.target)) menu.current.open = false;
    }
    function escape(event) {
      if (event.key === "Escape" && menu.current.open) {
        menu.current.open = false;
        menu.current.querySelector("summary").focus();
      }
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [route]);
  return (
    <details className="profile-menu" ref={menu}>
      <summary className="identity">
        <Avatar name={name} />
        <span className="profile-label">
          <b>{name}</b>
          <span>Learning Explorer</span>
        </span>
      </summary>
      <div className="profile-links">
        {[
          ["profile", "My Profile"],
          ["settings", "Settings"],
        ].map(([path, title]) => (
          <a
            key={path}
            href={url(path)}
            onClick={() => (menu.current.open = false)}
          >
            {title}
          </a>
        ))}
      </div>
    </details>
  );
}

export function Profile({ name, saveName, editing }) {
  const [value, setValue] = useState(name === "Student" ? "" : name);
  const [message, setMessage] = useState("");
  function submit(e) {
    e.preventDefault();
    try {
      saveName(value.trim());
      setMessage("Name saved.");
    } catch {
      setMessage("Your name could not be saved on this device.");
    }
  }
  return (
    <>
      <PageTitle title={editing ? "Settings" : "My Profile"} />
      <section className="panel pad form">
        <div className="profile-card">
          <Avatar name={name} />
          <div>
            <h2>{name}</h2>
            <p>Learning Explorer</p>
          </div>
        </div>
        {editing ? (
          <form onSubmit={submit}>
            <label>
              Student name
              <input
                value={value}
                maxLength={80}
                autoComplete="name"
                onChange={(e) => {
                  setValue(e.target.value);
                  setMessage("");
                }}
              />
            </label>
            <button className="primary" disabled={!value.trim()}>
              Save name
            </button>
            <p role="status">{message}</p>
          </form>
        ) : (
          <a className="button" href={url("settings")}>
            Edit name
          </a>
        )}
      </section>
    </>
  );
}

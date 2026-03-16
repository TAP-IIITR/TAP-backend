#let resume(
  info: (),
  body
) = {
  set document(title: info.name + " - Resume", author: info.name)
  set page(
    margin: (x: 0.75in, y: 0.75in),
  )
  set text(
    font: ("Ubuntu", "DejaVu Sans", "sans-serif"),
    size: 11pt,
    hyphenate: false,
  )





  // Name and Contact Info
  align(center)[
    #block(text(weight: "bold", size: 24pt)[#info.name])
    #v(-8pt)
    #text(size: 10pt)[
      #{
        let contact = ()
        if info.email != "" { contact.push(info.email) }
        if info.phone != "" { contact.push(info.phone) }
        if info.linkedin != "" { contact.push(link(info.linkedin)[LinkedIn]) }
        if info.github != "" and info.github != none { contact.push(link(info.github)[GitHub]) }
        contact.join(" | ")
      }
    ]
  ]

  body
}

#let section(title) = {
  v(12pt)
  text(weight: "bold", size: 14pt)[#upper(title)]
  v(-8pt)
  line(length: 100%, stroke: 0.5pt)
  v(2pt)
}

#let entry(
  title: "",
  subtitle: "",
  location: "",
  date: "",
  description: []
) = {
  v(4pt)
  grid(
    columns: (1fr, auto),
    text(weight: "bold")[#title],
    text(style: "italic")[#date]
  )
  if subtitle != "" or location != "" {
    grid(
      columns: (1fr, auto),
      text(style: "italic")[#subtitle],
      text[#location]
    )
  }
  v(-2pt)
  description
}

#let skill_category(category, items) = {
  v(4pt)
  text(weight: "bold")[#category: ]
  if type(items) == str {
    items
  } else {
    items.join(", ")
  }
}

// --- Resume Implementation ---

#show: body => resume(
  info: (
    name: "$NAME$",
    email: "$EMAIL$",
    phone: "$PHONE$",
    linkedin: "$LINKEDIN$",
    github: "$GITHUB$"
  ),
  body
)

#section("Education")
$EDUCATION$

#section("Experience")
$EXPERIENCE$

#section("Projects")
$PROJECTS$

#section("Skills")
$SKILLS$

#section("Achievements")
$ACHIEVEMENTS$
